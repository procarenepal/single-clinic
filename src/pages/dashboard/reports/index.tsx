import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import {
  IoCalendarOutline,
  IoPeopleOutline,
  IoMedicalOutline,
  IoStatsChartOutline,
  IoDownloadOutline,
  IoFilterOutline,
  IoMedkitOutline,
  IoMedkitSharp,
  IoStorefrontOutline,
  IoLayersOutline,
  IoReceiptOutline,
  IoCheckmarkCircleOutline,
  IoTimeOutline,
  IoCloseCircleOutline,
} from "react-icons/io5";

import { Button } from "@/components/ui/button";
import { Tabs, Tab } from "@/components/ui/tabs";
import { Divider } from "@/components/ui/divider";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Autocomplete, AutocompleteItem } from "@/components/ui/autocomplete";
import { title } from "@/components/primitives";
import { Skeleton } from "@/components/ui";
import { Checkbox } from "@/components/ui/checkbox";
import { addToast } from "@/components/ui/toast";
import { useAuthContext } from "@/context/AuthContext";

// Services
import { appointmentService } from "@/services/appointmentService";
import { patientService } from "@/services/patientService";
import { doctorService } from "@/services/doctorService";
import { medicineService } from "@/services/medicineService";
import { pharmacyService } from "@/services/pharmacyService";
import { itemService } from "@/services/itemService";
import { itemCategoryService } from "@/services/itemCategoryService";
import { issuedItemService } from "@/services/issuedItemService";
import { appointmentBillingService } from "@/services/appointmentBillingService";
import { pathologyBillingService } from "@/services/pathologyBillingService";
import { referralPartnerService } from "@/services/referralPartnerService";
import { appointmentTypeService } from "@/services/appointmentTypeService";
import { branchService } from "@/services/branchService";
import { expertService } from "@/services/expertService";

// Types
import {
  Appointment,
  Patient,
  Doctor,
  Medicine,
  MedicineStock,
  MedicinePurchase,
  MedicineUsage,
  StockTransaction,
  Item,
  ItemCategory,
  IssuedItem,
  AppointmentBilling,
  AppointmentBillingSettings,
  PathologyBilling,
  PathologyBillingSettings,
  ReferralPartner,
  AppointmentType,
  Branch,
  Expert,
} from "@/types/models";

interface ReportData {
  appointments: Appointment[];
  patients: Patient[];
  doctors: Doctor[];
  experts: Expert[];
  appointmentTypes: AppointmentType[];
  medicines: Medicine[];
  medicineStock: (MedicineStock & { medicine: Medicine })[];
  medicinePurchases: MedicinePurchase[];
  medicineUsage: MedicineUsage[];
  stockTransactions: StockTransaction[];
  items: Item[];
  itemCategories: ItemCategory[];
  issuedItems: IssuedItem[];
  billings: AppointmentBilling[];
  billingSettings: AppointmentBillingSettings | null;
  pathologyBillings: PathologyBilling[];
  pathologyBillingSettings: PathologyBillingSettings | null;
  referralPartners: ReferralPartner[];
}

// Helper function to format date in yyyy/mm/dd format
const formatDate = (date: Date | string) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}/${month}/${day}`;
};

// Helper function to format time in 12-hour format
const formatTime = (time: string | undefined) => {
  if (!time) return "N/A";

  // If time is already in HH:MM format
  const [hours, minutes] = time.split(":");

  if (!hours || !minutes) return time;

  const hour24 = parseInt(hours, 10);
  const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
  const ampm = hour24 >= 12 ? "PM" : "AM";

  return `${hour12}:${minutes} ${ampm}`;
};

interface OverviewStats {
  totalAppointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
  totalPatients: number;
  activeDoctors: number;
  criticalPatients: number;
  completionRate: number;
}

export default function ReportsPage() {
  const navigate = useNavigate();
  const { clinicId, userData } = useAuthContext();
  const branchId = userData?.branchId ?? null;

  const isClinicAdmin =
    userData?.role === "clinic-admin" || userData?.role === "system-owner";

  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const mainBranchId = branches.find((b) => b.isMainBranch)?.id ?? null;
  const reportBranchId =
    branchId ??
    (mainBranchId && selectedBranchId === mainBranchId
      ? undefined
      : (selectedBranchId ?? undefined));

  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<ReportData>({
    appointments: [],
    patients: [],
    doctors: [],
    experts: [],
    appointmentTypes: [],
    medicines: [],
    medicineStock: [],
    medicinePurchases: [],
    medicineUsage: [],
    stockTransactions: [],
    items: [],
    itemCategories: [],
    issuedItems: [],
    billings: [],
    billingSettings: null,
    pathologyBillings: [],
    pathologyBillingSettings: null,
    referralPartners: [],
  });
  const [selectedTab, setSelectedTab] = useState("overview");
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .split("T")[0],
    end: new Date().toISOString().split("T")[0],
  });
  const [selectedDoctor, setSelectedDoctor] = useState("all");
  const [selectedAppointmentType, setSelectedAppointmentType] = useState("all");
  const [isGenerating, setIsGenerating] = useState(false);
  const [allDates, setAllDates] = useState(true);
  const [showAllDoctorsAnalysis, setShowAllDoctorsAnalysis] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);

  // Create doctor and partner options for select
  const doctorOptions = [
    { key: "all", label: "All Doctors / Partners" },
    ...reportData.doctors.map((doctor) => ({
      key: doctor.id,
      label: `Dr. ${doctor.name}`,
    })),
    ...reportData.experts.map((expert) => ({
      key: expert.id,
      label: `Expert: ${expert.name}`,
    })),
    ...reportData.referralPartners.map((partner) => ({
      key: partner.id,
      label: `Partner: ${partner.name}`,
    })),
  ];

  // Create appointment type options for select
  const appointmentTypeOptions = [
    { key: "all", label: "All Appointment Types" },
    ...reportData.appointmentTypes.map((appointmentType) => ({
      key: appointmentType.id,
      label: appointmentType.name,
    })),
  ];

  // Load branches for clinic-wide admins (no fixed branchId)
  useEffect(() => {
    if (!clinicId || !isClinicAdmin || branchId) return;
    let cancelled = false;

    (async () => {
      try {
        const data = await branchService.getClinicBranches(clinicId, true);

        if (cancelled) return;
        setBranches(data);
        if (data.length > 0) {
          setSelectedBranchId((prev) => prev ?? data[0].id);
        } else {
          setSelectedBranchId(null);
        }
      } catch (err) {
        console.error("Reports branches fetch error:", err);
        if (!cancelled) {
          setBranches([]);
          setSelectedBranchId(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clinicId, isClinicAdmin, branchId]);

  // When user has fixed branch, clear admin branch filter
  useEffect(() => {
    if (branchId) setSelectedBranchId(null);
  }, [branchId]);

  // Load data on component mount
  useEffect(() => {
    let isMounted = true; // Flag to track if component is still mounted
    const abortController = new AbortController(); // For canceling fetch requests if supported

    const loadReportData = async () => {
      if (!clinicId) return;

      setLoading(true);
      try {
        const [
          appointments,
          patients,
          doctors,
          experts,
          appointmentTypes,
          medicines,
          medicineStock,
          medicinePurchases,
          medicineUsage,
          items,
          itemCategories,
          issuedItems,
        ] = await Promise.all([
          appointmentService.getAppointmentsByClinic(clinicId, reportBranchId),
          patientService.getPatientsByClinic(clinicId, reportBranchId),
          doctorService.getDoctorsByClinic(clinicId, reportBranchId),
          expertService.getExpertsByClinic(clinicId, reportBranchId),
          appointmentTypeService.getAppointmentTypesByClinic(
            clinicId,
            reportBranchId,
          ),
          medicineService.getMedicinesByClinic(
            clinicId,
            undefined,
            reportBranchId,
          ),
          medicineService.getStockByClinic(clinicId, reportBranchId),
          pharmacyService.getMedicinePurchasesByClinic(
            clinicId,
            reportBranchId,
          ),
          pharmacyService.getMedicineUsageByClinic(clinicId, reportBranchId),
          itemService.getItemsByClinic(clinicId, reportBranchId),
          itemCategoryService.getCategoriesByClinic(clinicId, reportBranchId),
          issuedItemService.getIssuedItemsByClinic(clinicId, reportBranchId),
        ]);

        // Check if component is still mounted before proceeding
        if (!isMounted) return;

        // Load billing data if enabled
        let billings: AppointmentBilling[] = [];
        let billingSettings: AppointmentBillingSettings | null = null;

        try {
          const [settings, data] = await Promise.all([
            appointmentBillingService.getBillingSettings(clinicId),
            appointmentBillingService.getBillingByClinic(
              clinicId,
              reportBranchId,
            ),
          ]);

          billings = data;
          billingSettings = settings;
        } catch (billingError) {
          console.warn("Appointment billing data not available:", billingError);
        }

        // Load pathology billing data
        let pathologyBillings: PathologyBilling[] = [];
        let pathologyBillingSettings: PathologyBillingSettings | null = null;

        try {
          const [pSettings, pData] = await Promise.all([
            pathologyBillingService.getBillingSettings(clinicId),
            pathologyBillingService.getBillingByClinic(
              clinicId,
              reportBranchId,
            ),
          ]);

          pathologyBillings = pData;
          pathologyBillingSettings = pSettings;
        } catch (pBillingError) {
          console.warn("Pathology billing data not available:", pBillingError);
        }

        // Load referral partners
        let referralPartners: ReferralPartner[] = [];

        try {
          referralPartners =
            await referralPartnerService.getReferralPartnersByClinic(clinicId);
        } catch (rpError) {
          console.warn("Referral partners data not available:", rpError);
        }

        // TODO: Implement stockTransactions service method
        const stockTransactions: StockTransaction[] = [];

        // Only update state if component is still mounted
        if (isMounted) {
          setReportData({
            appointments,
            patients,
            doctors,
            experts,
            appointmentTypes,
            medicines,
            medicineStock,
            medicinePurchases,
            medicineUsage,
            stockTransactions,
            items,
            itemCategories,
            issuedItems,
            billings,
            billingSettings,
            pathologyBillings,
            pathologyBillingSettings,
            referralPartners,
          });
        }
      } catch (error) {
        // Only handle error if component is still mounted
        if (isMounted) {
          console.error("Error loading report data:", error);
          addToast({
            title: "Error Loading Data",
            description: "Failed to load report data. Please try again.",
            color: "danger",
          });
        }
      } finally {
        // Only update loading state if component is still mounted
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadReportData();

    // Cleanup function to prevent memory leaks
    return () => {
      isMounted = false;
      abortController.abort(); // Cancel any ongoing requests if services support AbortController
    };
  }, [clinicId, reportBranchId]);

  // Filter appointments by date range, doctor, and appointment type
  const getFilteredAppointments = () => {
    return reportData.appointments.filter((appointment) => {
      const appointmentDate = new Date(appointment.appointmentDate);
      const startDate = new Date(dateRange.start);

      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(dateRange.end);

      endDate.setHours(23, 59, 59, 999);

      const isInDateRange = allDates
        ? true
        : appointmentDate >= startDate && appointmentDate <= endDate;
      const matchesDoctor =
        selectedDoctor === "all" ||
        appointment.doctorId === selectedDoctor ||
        appointment.assignedExpertId === selectedDoctor;
      const matchesAppointmentType =
        selectedAppointmentType === "all" ||
        appointment.appointmentTypeId === selectedAppointmentType;

      return isInDateRange && matchesDoctor && matchesAppointmentType;
    });
  };

  // Filter patients by date range (createdAt), selected doctor, and selected appointment type
  const getFilteredPatients = () => {
    const startDate = new Date(dateRange.start);

    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(dateRange.end);

    endDate.setHours(23, 59, 59, 999);

    return reportData.patients.filter((p) => {
      // Date filter based on patient registration date OR appointment date
      let dateOk = true;

      if (!allDates) {
        let createdOk = false;

        if (p.createdAt) {
          const created = new Date(p.createdAt as any);

          if (!Number.isNaN(created.getTime())) {
            createdOk = created >= startDate && created <= endDate;
          }
        }

        // Also check if they had an appointment in this date range
        const hasAppointmentInDateRange = reportData.appointments.some(
          (apt) => {
            if (apt.patientId !== p.id) return false;
            const aptDate = new Date(apt.appointmentDate);

            return aptDate >= startDate && aptDate <= endDate;
          },
        );

        dateOk = createdOk || hasAppointmentInDateRange;
      }

      // Doctor filter: assigned doctor OR has any appointment with selected doctor within date window
      let doctorOk = true;

      if (selectedDoctor !== "all") {
        const assignedMatches =
          (p as any).doctorId === selectedDoctor ||
          (p as any).assignedExpertId === selectedDoctor;
        const hasAppointmentWithDoctor = reportData.appointments.some((apt) => {
          if (apt.patientId !== p.id) return false;
          if (
            apt.doctorId !== selectedDoctor &&
            apt.assignedExpertId !== selectedDoctor
          )
            return false;
          if (allDates) return true;
          const aptDate = new Date(apt.appointmentDate);

          return aptDate >= startDate && aptDate <= endDate;
        });

        doctorOk = assignedMatches || hasAppointmentWithDoctor;
      }

      // Appointment type filter: has any appointment of selected type within date window
      let appointmentTypeOk = true;

      if (selectedAppointmentType !== "all") {
        appointmentTypeOk = reportData.appointments.some((apt) => {
          if (apt.patientId !== p.id) return false;
          if (apt.appointmentTypeId !== selectedAppointmentType) return false;
          if (allDates) return true;
          const aptDate = new Date(apt.appointmentDate);

          return aptDate >= startDate && aptDate <= endDate;
        });
      }

      return dateOk && doctorOk && appointmentTypeOk;
    });
  };

  const visitsByPatientId = useMemo(() => {
    const counts: Record<string, number> = {};

    for (const apt of reportData.appointments) {
      if (apt.status === "cancelled") continue;
      const patientId = apt.patientId;

      if (!patientId) continue;
      counts[patientId] = (counts[patientId] ?? 0) + 1;
    }

    return counts;
  }, [reportData.appointments]);

  // Filter pharmacy data by date range (for Pharmacy tab)
  const filteredPharmacyPurchases = useMemo(() => {
    if (allDates || !dateRange.start || !dateRange.end)
      return reportData.medicinePurchases;
    const start = new Date(dateRange.start);

    start.setHours(0, 0, 0, 0);
    const end = new Date(dateRange.end);

    end.setHours(23, 59, 59, 999);

    return reportData.medicinePurchases.filter((p) => {
      const d = p.purchaseDate
        ? new Date(p.purchaseDate)
        : p.createdAt
          ? new Date((p as any).createdAt)
          : null;

      if (!d || Number.isNaN(d.getTime())) return false;

      return d >= start && d <= end;
    });
  }, [reportData.medicinePurchases, dateRange.start, dateRange.end, allDates]);

  const filteredPharmacyUsage = useMemo(() => {
    if (allDates || !dateRange.start || !dateRange.end)
      return reportData.medicineUsage;
    const start = new Date(dateRange.start);

    start.setHours(0, 0, 0, 0);
    const end = new Date(dateRange.end);

    end.setHours(23, 59, 59, 999);

    return reportData.medicineUsage.filter((u) => {
      const d = u.usageDate
        ? new Date(u.usageDate)
        : u.createdAt
          ? new Date((u as any).createdAt)
          : null;

      if (!d || Number.isNaN(d.getTime())) return false;

      return d >= start && d <= end;
    });
  }, [reportData.medicineUsage, dateRange.start, dateRange.end, allDates]);

  // Filter billings by date range and doctor (for Billing tab)
  const filteredBillings = useMemo(() => {
    if (!reportData.billingSettings || !reportData.billings.length)
      return reportData.billings;

    // Start with all billings
    let billings = reportData.billings;

    // Apply date range filter if not showing all dates
    if (!allDates && dateRange.start && dateRange.end) {
      const start = new Date(dateRange.start);

      start.setHours(0, 0, 0, 0);
      const end = new Date(dateRange.end);

      end.setHours(23, 59, 59, 999);

      billings = billings.filter((b) => {
        const d = b.invoiceDate
          ? new Date(b.invoiceDate)
          : b.createdAt
            ? new Date((b as any).createdAt)
            : null;

        if (!d || Number.isNaN(d.getTime())) return false;

        return d >= start && d <= end;
      });
    }

    // Apply doctor filter if a specific doctor is selected
    if (selectedDoctor !== "all") {
      // Include bills where the selected doctor is the primary OR appears on any item OR is a referral partner
      billings = billings.filter(
        (b) =>
          b.doctorId === selectedDoctor ||
          b.items.some((item) => item.doctorId === selectedDoctor) ||
          b.referralPartnerId === selectedDoctor ||
          (b.referrals && b.referrals.some((r) => r.id === selectedDoctor)),
      );
    }

    // Apply appointment type filter if a specific appointment type is selected
    if (selectedAppointmentType !== "all") {
      billings = billings.filter((b) =>
        b.items.some(
          (item) => item.appointmentTypeId === selectedAppointmentType,
        ),
      );
    }

    return billings;
  }, [
    allDates,
    selectedDoctor,
    selectedAppointmentType,
    dateRange.start,
    dateRange.end,
    reportData.billings,
    reportData.billingSettings,
  ]);

  // Filter pathology billings by date range and doctor
  const filteredPathologyBillings = useMemo(() => {
    if (
      !reportData.pathologyBillingSettings ||
      !reportData.pathologyBillings.length
    )
      return reportData.pathologyBillings;

    // Start with all pathology billings
    let billings = reportData.pathologyBillings;

    // Apply date range filter if not showing all dates
    if (!allDates && dateRange.start && dateRange.end) {
      const start = new Date(dateRange.start);

      start.setHours(0, 0, 0, 0);
      const end = new Date(dateRange.end);

      end.setHours(23, 59, 59, 999);

      billings = billings.filter((b) => {
        const d = b.invoiceDate ? new Date(b.invoiceDate) : null;

        if (!d || Number.isNaN(d.getTime())) return false;

        return d >= start && d <= end;
      });
    }

    // Apply doctor filter
    if (selectedDoctor !== "all") {
      billings = billings.filter((b) => {
        // In Pathology, the doctor is found in referringDoctors array
        const isReferrer = b.referringDoctors?.some(
          (rd) => rd.doctorId === selectedDoctor,
        );

        return isReferrer;
      });
    }

    return billings;
  }, [
    reportData.pathologyBillings,
    reportData.pathologyBillingSettings,
    dateRange.start,
    dateRange.end,
    allDates,
    selectedDoctor,
  ]);

  const generateOverviewStats = (): OverviewStats => {
    const filteredAppointments = getFilteredAppointments();
    const filteredPatients = getFilteredPatients();

    const totalAppointments = filteredAppointments.length;
    const completedAppointments = filteredAppointments.filter(
      (a) => a.status === "completed",
    ).length;
    const cancelledAppointments = filteredAppointments.filter(
      (a) => a.status === "cancelled",
    ).length;
    const totalPatients = filteredPatients.length;
    const activeDoctors = reportData.doctors.filter((d) => d.isActive).length;
    const criticalPatients = filteredPatients.filter(
      (p) => p.isCritical,
    ).length;

    const completionRate =
      totalAppointments > 0
        ? Math.round((completedAppointments / totalAppointments) * 100)
        : 0;

    return {
      totalAppointments,
      completedAppointments,
      cancelledAppointments,
      totalPatients,
      activeDoctors,
      criticalPatients,
      completionRate,
    };
  };

  // Export functions
  const exportToExcel = (data: any[], filename: string, sheetName: string) => {
    setIsGenerating(true);
    try {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(data);

      // Auto-size columns
      const colWidths = Object.keys(data[0] || {}).map((key) => ({
        wch: Math.max(key.length, 15),
      }));

      ws["!cols"] = colWidths;

      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      XLSX.writeFile(
        wb,
        `${filename}_${new Date().toISOString().split("T")[0]}.xlsx`,
      );

      addToast({
        title: "Export Successful",
        description: `${filename} has been exported successfully.`,
        color: "success",
      });
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      addToast({
        title: "Export Failed",
        description: "Failed to export data. Please try again.",
        color: "danger",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const exportAppointmentsReport = () => {
    const filteredAppointments = getFilteredAppointments();
    const appointmentsExportData = filteredAppointments.map((appointment) => {
      const patient = reportData.patients.find(
        (p) => p.id === appointment.patientId,
      );
      const doctor = reportData.doctors.find(
        (d) => d.id === appointment.doctorId,
      );

      return {
        Date: formatDate(appointment.appointmentDate),
        Time: formatTime(appointment.startTime),
        "Patient Name": patient?.name || "Unknown",
        "Patient Reg #": patient?.regNumber || "N/A",
        Doctor: doctor?.name || "Unknown",
        Status: appointment.status,
        Reason: appointment.reason || "N/A",
        Notes: appointment.notes || "N/A",
        "Created Date": formatDate(appointment.createdAt),
      };
    });

    exportToExcel(
      appointmentsExportData,
      "Appointments_Report",
      "Appointments",
    );
  };

  const exportPatientsReport = () => {
    const patientsData = getFilteredPatients().map((patient) => {
      const assignedDoctor =
        reportData.doctors.find((d) => d.id === (patient as any).doctorId)
          ?.name || "N/A";

      return {
        Name: patient.name,
        "Registration Number": patient.regNumber || "N/A",
        Email: patient.email || "N/A",
        Mobile: patient.phone || "N/A",
        Gender: patient.gender || "N/A",
        Age: patient.age || "N/A",
        Address: patient.address || "N/A",
        "Assigned Doctor": assignedDoctor,
        "Critical Status": patient.isCritical ? "Critical" : "Normal",
        "Registration Date": formatDate(patient.createdAt),
      };
    });

    exportToExcel(patientsData, "Patients_Report", "Patients");
  };

  const exportDoctorsReport = () => {
    const doctorsData = reportData.doctors.map((doctor) => ({
      Name: doctor.name,
      "NMC Number": doctor.nmcNumber || "N/A",
      Email: doctor.email || "N/A",
      Phone: doctor.phone || "N/A",
      Speciality: doctor.speciality || "N/A",
      Type: doctor.doctorType || "N/A",
      Commission: `${doctor.defaultCommission || 0}%`,
      Status: doctor.isActive ? "Active" : "Inactive",
      "Joining Date": formatDate(doctor.createdAt),
    }));

    exportToExcel(doctorsData, "Doctors_Report", "Doctors");
  };

  const exportMedicinesReport = () => {
    const medicinesData = reportData.medicines.map((medicine) => {
      const stocks = reportData.medicineStock.filter(
        (s) => s.medicineId === medicine.id,
      );
      const totalStock = stocks.reduce((sum, s) => sum + (s.currentStock || 0), 0);
      const minStock = stocks.length > 0 ? stocks[0].minimumStock : 0;

      return {
        Name: medicine.name,
        "Generic Name": medicine.genericName || "N/A",
        Strength: medicine.strength || "N/A",
        Unit: medicine.unit || "N/A",
        Price: medicine.price ? `NPR ${medicine.price}` : "N/A",
        "Current Stock": totalStock,
        "Minimum Stock": minStock,
        Status: medicine.isActive ? "Active" : "Inactive",
        "Expiry Date": medicine.expiryDate
          ? formatDate(medicine.expiryDate)
          : "N/A",
        "Added Date": formatDate(medicine.createdAt),
      };
    });

    exportToExcel(medicinesData, "Medicines_Report", "Medicines");
  };

  const exportPharmacyReport = () => {
    const toExport = filteredPharmacyPurchases;
    const pharmacyData = toExport.map((purchase) => {
      // Get medicine details from the first item if available
      const firstItem = purchase.items?.[0];
      const medicine = firstItem
        ? reportData.medicines.find((m) => m.id === firstItem.medicineId)
        : null;

      return {
        "Purchase No": purchase.purchaseNo,
        Date: formatDate(purchase.purchaseDate),
        "Medicine(s)": firstItem ? firstItem.medicineName : "N/A",
        "Total Items": purchase.items?.length || 0,
        Subtotal: `NPR ${purchase.total}`,
        "Tax Amount": `NPR ${purchase.taxAmount}`,
        "Net Amount": `NPR ${purchase.netAmount}`,
        "Payment Type": purchase.paymentType || "N/A",
        "Payment Status": purchase.paymentStatus,
        "Payment Note": purchase.paymentNote || "N/A",
        "Created Date": formatDate(purchase.createdAt),
      };
    });

    exportToExcel(pharmacyData, "Pharmacy_Report", "Pharmacy");
  };

  const exportPathologyReport = () => {
    if (!reportData.pathologyBillings.length) {
      addToast({
        title: "No Data",
        description: "No pathology billing data available for export.",
        color: "warning",
      });

      return;
    }

    setIsGenerating(true);
    try {
      const pathologyData = filteredPathologyBillings.map((billing) => {
        const patient = reportData.patients.find(
          (p) => p.id === billing.patientId,
        );

        // For pathology, we attribute based on referral records
        let attributedRevenue = billing.totalAmount;

        if (selectedDoctor !== "all") {
          const referral = billing.referringDoctors?.find(
            (rd) => rd.doctorId === selectedDoctor,
          );

          if (referral) {
            attributedRevenue = referral.calculatedAmount;
          } else {
            attributedRevenue = 0;
          }
        }

        return {
          "Invoice Number": billing.invoiceNumber,
          Date: formatDate(billing.invoiceDate),
          "Patient Name": billing.patientName,
          "Patient Reg #": patient?.regNumber || "N/A",
          "Referring Source(s)":
            billing.referringDoctors
              ?.map((rd) => `${rd.doctorName} (${rd.type})`)
              .join(", ") || "None",
          "Attributed Revenue": `NPR ${Math.round(attributedRevenue).toLocaleString()}`,
          "Total Amount": `NPR ${(billing.subtotal || 0).toLocaleString()}`,
          Discount: `NPR ${(billing.discountAmount || 0).toLocaleString()}`,
          "Net Amount": `NPR ${(billing.totalAmount || 0).toLocaleString()}`,
          "Paid Amount": `NPR ${(billing.paidAmount || 0).toLocaleString()}`,
          "Balance Amount": `NPR ${(billing.balanceAmount || 0).toLocaleString()}`,
          "Payment Status": billing.paymentStatus,
          "Created Date": formatDate(billing.createdAt),
          "Tests Count": billing.items?.length || 0,
        };
      });

      exportToExcel(pathologyData, "Pathology_Billing_Report", "Pathology");
    } catch (error) {
      console.error("Error exporting pathology report:", error);
      addToast({
        title: "Export Error",
        description: "Failed to generate pathology report.",
        color: "danger",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const exportInventoryReport = () => {
    if (!reportData) return;

    // Get filtered inventory items - remove search filtering since searchTerm isn't available here
    const filteredItems = reportData.items;

    // Create main inventory worksheet
    const inventorySheetData = filteredItems.map((item) => ({
      "Item Name": item.name,
      Category: item.category || "Uncategorized",
      Barcode: item.barcode || "",
      Quantity: item.quantity || 0,
      Unit: item.unit || "",
      "Purchase Price": item.purchasePrice || 0,
      "Sale Price": item.salePrice || 0,
      Description: item.description || "",
      Status: item.isActive ? "Active" : "Inactive",
      "Created Date": item.createdAt
        ? new Date(item.createdAt).toLocaleDateString()
        : "",
      "Updated Date": item.updatedAt
        ? new Date(item.updatedAt).toLocaleDateString()
        : "",
    }));

    // Create categories worksheet
    const categoriesSheetData = reportData.itemCategories.map((category) => ({
      "Category Name": category.name,
      Description: category.description || "",
      "Items Count": reportData.items.filter(
        (item) => item.category === category.name,
      ).length,
      Status: category.isActive ? "Active" : "Inactive",
      "Created Date": category.createdAt
        ? new Date(category.createdAt).toLocaleDateString()
        : "",
    }));

    // Create issued items worksheet
    const issuedItemsSheetData = reportData.issuedItems
      .filter((issuedItem) => {
        if (!dateRange.start || !dateRange.end) return true;
        if (!issuedItem.issuedDate) return false;

        const issuedDate = new Date(issuedItem.issuedDate);
        const startDate = new Date(dateRange.start);
        const endDate = new Date(dateRange.end);

        return issuedDate >= startDate && issuedDate <= endDate;
      })
      .map((issuedItem) => ({
        "Item Name": issuedItem.itemName || "",
        Category: issuedItem.itemCategory || "",
        "Quantity Issued": issuedItem.quantity || 0,
        "Issued To": issuedItem.issuedTo || "",
        "Issued By": issuedItem.issuedBy || "",
        "Issued Date": issuedItem.issuedDate
          ? new Date(issuedItem.issuedDate).toLocaleDateString()
          : "",
        "Issued Time": issuedItem.issuedDate
          ? formatTime(new Date(issuedItem.issuedDate).toLocaleTimeString())
          : "",
        "Expected Return": issuedItem.expectedReturnDate
          ? new Date(issuedItem.expectedReturnDate).toLocaleDateString()
          : "",
        "Return Date": issuedItem.returnDate
          ? new Date(issuedItem.returnDate).toLocaleDateString()
          : "",
        Status: issuedItem.status || "",
        Notes: issuedItem.notes || "",
      }));

    // Create workbook with multiple sheets
    const wb = XLSX.utils.book_new();

    // Add inventory items sheet
    const inventoryWS = XLSX.utils.json_to_sheet(inventorySheetData);

    XLSX.utils.book_append_sheet(wb, inventoryWS, "Inventory Items");

    // Add categories sheet
    const categoriesWS = XLSX.utils.json_to_sheet(categoriesSheetData);

    XLSX.utils.book_append_sheet(wb, categoriesWS, "Categories");

    // Add issued items sheet
    const issuedItemsWS = XLSX.utils.json_to_sheet(issuedItemsSheetData);

    XLSX.utils.book_append_sheet(wb, issuedItemsWS, "Issued Items");

    // Auto-size columns
    [inventoryWS, categoriesWS, issuedItemsWS].forEach((ws) => {
      const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
      const wscols: any[] = [];

      for (let C = range.s.c; C <= range.e.c; ++C) {
        wscols[C] = { wch: 15 };
      }
      ws["!cols"] = wscols;
    });

    // Save file
    const fileName = `inventory-report-${new Date().toISOString().split("T")[0]}.xlsx`;

    XLSX.writeFile(wb, fileName);
  };

  const exportBillingReport = () => {
    if (!reportData.billingSettings || !reportData.billings.length) {
      addToast({
        title: "No Data",
        description: "No billing data available for export.",
        color: "warning",
      });

      return;
    }

    setIsGenerating(true);
    try {
      const billingData = filteredBillings.map((billing) => {
        const patient = reportData.patients.find(
          (p) => p.id === billing.patientId,
        );
        const doctor = reportData.doctors.find(
          (d) => d.id === billing.doctorId,
        );

        // Calculate attributed revenue if a specific doctor or appointment type is selected
        let attributedAmount = billing.totalAmount;

        if (selectedDoctor !== "all" || selectedAppointmentType !== "all") {
          const itemsTotal =
            billing.items.reduce((s, i) => s + (i.amount || 0), 0) ||
            billing.subtotal ||
            1;
          const scaleFactor =
            itemsTotal > 0 ? billing.totalAmount / itemsTotal : 1;
          const matchingItems = billing.items.filter((item) => {
            const matchesDoctor =
              selectedDoctor === "all" ||
              (item.doctorId || billing.doctorId) === selectedDoctor;
            const matchesType =
              selectedAppointmentType === "all" ||
              item.appointmentTypeId === selectedAppointmentType;

            return matchesDoctor && matchesType;
          });

          attributedAmount =
            matchingItems.reduce((s, i) => s + (i.amount || 0), 0) *
            scaleFactor;
        }

        return {
          "Invoice Number": billing.invoiceNumber,
          Date: formatDate(billing.invoiceDate),
          "Patient Name": billing.patientName,
          "Patient Reg #": patient?.regNumber || "N/A",
          "Primary Doctor": billing.doctorName,
          "Attributed Doctor":
            selectedDoctor !== "all"
              ? reportData.doctors.find((d) => d.id === selectedDoctor)?.name ||
              reportData.experts.find((e) => e.id === selectedDoctor)?.name ||
              reportData.referralPartners.find((p) => p.id === selectedDoctor)
                ?.name ||
              "N/A"
              : billing.doctorName,
          "Doctor Type":
            billing.doctorType === "visitor" ? "Visiting" : "Regular",
          Subtotal: `NPR ${billing.subtotal.toLocaleString()}`,
          "Attributed Revenue": `NPR ${Math.round(attributedAmount).toLocaleString()}`,
          "Total Invoice Amount": `NPR ${billing.totalAmount.toLocaleString()}`,
          "Discount Type": billing.discountType,
          "Discount Value": billing.discountValue,
          "Discount Amount": `NPR ${billing.discountAmount.toLocaleString()}`,
          "Tax Rate": `${billing.taxPercentage}%`,
          "Tax Amount": `NPR ${billing.taxAmount.toLocaleString()}`,
          "Total Amount": `NPR ${billing.totalAmount.toLocaleString()}`,
          "Payment Status": billing.paymentStatus,
          "Paid Amount": `NPR ${billing.paidAmount.toLocaleString()}`,
          "Balance Amount": `NPR ${billing.balanceAmount.toLocaleString()}`,
          "Payment Method": billing.paymentMethod || "N/A",
          "Payment Reference": billing.paymentReference || "N/A",
          "Payment Date": billing.paymentDate
            ? formatDate(billing.paymentDate)
            : "N/A",
          Status: billing.status,
          Notes: billing.notes || "N/A",
          "Created Date": formatDate(billing.createdAt),
          "Items Count": billing.items.length,
          "Items Detail": billing.items
            .map(
              (item) =>
                `${item.appointmentTypeName} (Qty: ${item.quantity}, Price: NPR ${item.price})`,
            )
            .join("; "),
        };
      });

      exportToExcel(billingData, "Billing_Report", "Billing");
    } catch (error) {
      console.error("Error exporting billing report:", error);
      addToast({
        title: "Export Failed",
        description: "Failed to export billing data. Please try again.",
        color: "danger",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-4 animate-in fade-in duration-500">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-[500px] w-full rounded-2xl" />
      </div>
    );
  }

  const stats = generateOverviewStats();

  return (
    <div className="flex flex-col gap-4">
      {/* Page Header — spec: clarity-page-header, clarity-page-title, clarity-page-subtitle */}
      <div className="clarity-page-header flex-col sm:flex-row gap-4 !items-start sm:!items-center">
        <div>
          <h1 className={title({ size: "lg", color: "primary" })}>
            Reports & Analytics
          </h1>
          <p className="text-[13.5px] text-text-muted mt-1">
            Generate comprehensive reports and analyze clinic performance
          </p>
        </div>
        {!branchId && isClinicAdmin && branches.length > 0 && (
          <div className="flex items-center gap-1">
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
      </div>

      {/* Report Filters — clarity-card, clarity-input, custom Select/Checkbox */}
      <div className="clarity-card p-3">
        <div className="flex items-center gap-2 mb-3">
          <IoFilterOutline className="text-teal-700" />
          <h3 className="text-sm font-semibold uppercase tracking-wide text-mountain-600">
            Report Filters
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Input
            fullWidth
            isDisabled={allDates}
            label="Start Date"
            size="md"
            type="date"
            value={dateRange.start}
            onValueChange={(v) =>
              setDateRange((prev) => ({ ...prev, start: v }))
            }
          />
          <Input
            fullWidth
            isDisabled={allDates}
            label="End Date"
            size="md"
            type="date"
            value={dateRange.end}
            onValueChange={(v) => setDateRange((prev) => ({ ...prev, end: v }))}
          />
          <Autocomplete
            className="w-full"
            label="Doctor"
            selectedKey={selectedDoctor}
            onSelectionChange={(key) =>
              setSelectedDoctor((key as string) || "all")
            }
          >
            {doctorOptions.map((option) => (
              <AutocompleteItem key={option.key} textValue={option.label}>
                {option.label}
              </AutocompleteItem>
            ))}
          </Autocomplete>
          <Autocomplete
            className="w-full"
            label="Appointment Type"
            selectedKey={selectedAppointmentType}
            onSelectionChange={(key) =>
              setSelectedAppointmentType((key as string) || "all")
            }
          >
            {appointmentTypeOptions.map((option) => (
              <AutocompleteItem key={option.key} textValue={option.label}>
                {option.label}
              </AutocompleteItem>
            ))}
          </Autocomplete>
        </div>
        <div className="mt-3 flex items-center justify-end">
          <Checkbox isSelected={allDates} onValueChange={setAllDates}>
            Show all dates
          </Checkbox>
        </div>
      </div>

      {/* Reports Tabs — custom Tabs, Tab; content in clarity-card style */}
      <div className="clarity-card p-0 overflow-hidden">
        <Tabs
          className="w-full"
          classNames={{
            tabList:
              "w-full relative rounded-none px-4 pt-2 border-b border-mountain-200 dark:border-zinc-800 overflow-x-auto scrollbar-none",
            tab: "px-3 h-10 text-[13px]",
            tabContent: "text-teal-700 dark:text-teal-400 font-medium",
            cursor: "bg-teal-700 dark:bg-teal-400",
          }}
          color="primary"
          selectedKey={selectedTab}
          variant="underlined"
          onSelectionChange={(key) => setSelectedTab(key as string)}
        >
          <Tab
            key="overview"
            title={
              <span className="flex items-center gap-2">
                <IoStatsChartOutline className="w-4 h-4" />
                Overview
              </span>
            }
          >
            <div className="px-4 py-3">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                <div className="clarity-stat text-center">
                  <IoCalendarOutline className="text-teal-700 text-stat-sm mx-auto mb-1" />
                  <p className="clarity-stat-value text-teal-700">
                    {stats.totalAppointments}
                  </p>
                  <p className="clarity-stat-label">Total Appointments</p>
                </div>
                <div className="clarity-stat text-center">
                  <IoPeopleOutline className="text-health-600 text-stat-sm mx-auto mb-1" />
                  <p className="clarity-stat-value text-health-600">
                    {stats.totalPatients}
                  </p>
                  <p className="clarity-stat-label">Total Patients</p>
                </div>
                <div className="clarity-stat text-center">
                  <IoMedicalOutline className="text-health-600 text-stat-sm mx-auto mb-1" />
                  <p className="clarity-stat-value text-health-600">
                    {stats.activeDoctors}
                  </p>
                  <p className="clarity-stat-label">Active Doctors</p>
                </div>
                <div className="clarity-stat text-center">
                  <IoMedkitOutline className="text-saffron-600 text-stat-sm mx-auto mb-1" />
                  <p className="clarity-stat-value text-saffron-600">
                    {stats.completionRate}%
                  </p>
                  <p className="clarity-stat-label">Completion Rate</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="clarity-card p-3">
                  <h4 className="clarity-section-header">
                    Appointment Statistics
                  </h4>
                  <Divider className="my-2" />
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-mountain-600">
                        Completed Appointments
                      </span>
                      <Chip color="success" size="sm" variant="flat">
                        {stats.completedAppointments}
                      </Chip>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-mountain-600">
                        Cancelled Appointments
                      </span>
                      <Chip color="danger" size="sm" variant="flat">
                        {stats.cancelledAppointments}
                      </Chip>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-mountain-600">
                        Critical Patients
                      </span>
                      <Chip color="warning" size="sm" variant="flat">
                        {stats.criticalPatients}
                      </Chip>
                    </div>
                  </div>
                </div>

                <div className="clarity-card p-3">
                  <h4 className="clarity-section-header">Quick Export</h4>
                  <Divider className="my-2" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <Button
                      fullWidth
                      className="justify-start h-10 px-3 bg-primary-50/50 dark:bg-primary-900/10 border border-primary-100/50 dark:border-primary-800/30 text-primary-700 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-800/20 transition-all font-medium text-[13px]"
                      isLoading={isGenerating}
                      size="sm"
                      startContent={
                        <IoCalendarOutline className="w-4 h-4 opacity-80" />
                      }
                      variant="flat"
                      onPress={exportAppointmentsReport}
                    >
                      Appointments Report
                    </Button>
                    <Button
                      fullWidth
                      className="justify-start h-10 px-3 bg-secondary-50/50 dark:bg-secondary-900/10 border border-secondary-100/50 dark:border-secondary-800/30 text-secondary-700 dark:text-secondary-400 hover:bg-secondary-100 dark:hover:bg-secondary-800/20 transition-all font-medium text-[13px]"
                      isLoading={isGenerating}
                      size="sm"
                      startContent={
                        <IoPeopleOutline className="w-4 h-4 opacity-80" />
                      }
                      variant="flat"
                      onPress={exportPatientsReport}
                    >
                      Patients Report
                    </Button>
                    <Button
                      fullWidth
                      className="justify-start h-10 px-3 bg-success-50/50 dark:bg-success-900/10 border border-success-100/50 dark:border-success-800/30 text-success-700 dark:text-success-400 hover:bg-success-100 dark:hover:bg-success-800/20 transition-all font-medium text-[13px]"
                      isLoading={isGenerating}
                      size="sm"
                      startContent={
                        <IoMedicalOutline className="w-4 h-4 opacity-80" />
                      }
                      variant="flat"
                      onPress={exportDoctorsReport}
                    >
                      Doctors Report
                    </Button>
                    <Button
                      fullWidth
                      className="justify-start h-10 px-3 bg-warning-50/50 dark:bg-warning-900/10 border border-warning-100/50 dark:border-warning-800/30 text-warning-700 dark:text-warning-400 hover:bg-warning-100 dark:hover:bg-warning-800/20 transition-all font-medium text-[13px]"
                      isLoading={isGenerating}
                      size="sm"
                      startContent={
                        <IoMedkitOutline className="w-4 h-4 opacity-80" />
                      }
                      variant="flat"
                      onPress={exportMedicinesReport}
                    >
                      Medicines Report
                    </Button>
                    <Button
                      fullWidth
                      className="justify-start h-10 px-3 bg-secondary-50/50 dark:bg-secondary-900/10 border border-secondary-100/50 dark:border-secondary-800/30 text-secondary-700 dark:text-secondary-400 hover:bg-secondary-100 dark:hover:bg-secondary-800/20 transition-all font-medium text-[13px]"
                      isLoading={isGenerating}
                      size="sm"
                      startContent={
                        <IoStorefrontOutline className="w-4 h-4 opacity-80" />
                      }
                      variant="flat"
                      onPress={exportPharmacyReport}
                    >
                      Pharmacy Report
                    </Button>
                    <Button
                      fullWidth
                      className="justify-start h-10 px-3 bg-mountain-50/50 dark:bg-mountain-900/10 border border-mountain-200/50 dark:border-mountain-800/30 text-mountain-700 dark:text-mountain-400 hover:bg-mountain-100 dark:hover:bg-mountain-800/20 transition-all font-medium text-[13px]"
                      isLoading={isGenerating}
                      size="sm"
                      startContent={
                        <IoLayersOutline className="w-4 h-4 opacity-80" />
                      }
                      variant="flat"
                      onPress={exportInventoryReport}
                    >
                      Inventory Report
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </Tab>

          <Tab
            key="appointments"
            title={
              <span className="flex items-center gap-2">
                <IoCalendarOutline className="w-4 h-4" />
                Appointments
                <Chip color="primary" size="sm" variant="flat">
                  {getFilteredAppointments().length}
                </Chip>
              </span>
            }
          >
            <div className="px-4 py-3">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-semibold">Appointments Report</h3>
                <Button
                  color="primary"
                  isLoading={isGenerating}
                  size="sm"
                  startContent={<IoDownloadOutline className="w-3.5 h-3.5" />}
                  onPress={exportAppointmentsReport}
                >
                  Export Excel
                </Button>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                <div className="clarity-stat text-center">
                  <IoCalendarOutline className="text-teal-700 text-stat-sm mx-auto mb-1" />
                  <p className="clarity-stat-value text-teal-700">
                    {
                      getFilteredAppointments().filter(
                        (a) => a.status === "scheduled",
                      ).length
                    }
                  </p>
                  <p className="clarity-stat-label">Scheduled</p>
                </div>
                <div className="clarity-stat text-center">
                  <IoCheckmarkCircleOutline className="text-health-600 text-stat-sm mx-auto mb-1" />
                  <p className="clarity-stat-value text-health-600">
                    {
                      getFilteredAppointments().filter(
                        (a) => a.status === "completed",
                      ).length
                    }
                  </p>
                  <p className="clarity-stat-label">Completed</p>
                </div>
                <div className="clarity-stat text-center">
                  <IoTimeOutline className="text-saffron-600 text-stat-sm mx-auto mb-1" />
                  <p className="clarity-stat-value text-saffron-600">
                    {
                      getFilteredAppointments().filter(
                        (a) => a.status === "in-progress",
                      ).length
                    }
                  </p>
                  <p className="clarity-stat-label">In Progress</p>
                </div>
                <div className="clarity-stat text-center">
                  <IoCloseCircleOutline className="text-rose-600 text-stat-sm mx-auto mb-1" />
                  <p className="clarity-stat-value text-rose-600">
                    {
                      getFilteredAppointments().filter(
                        (a) => a.status === "cancelled",
                      ).length
                    }
                  </p>
                  <p className="clarity-stat-label">Cancelled</p>
                </div>
              </div>

              <div className="clarity-card p-3 mb-4">
                <p className="text-sm text-mountain-600 mb-1">
                  Total appointments in selected period:{" "}
                  <strong>{getFilteredAppointments().length}</strong>
                </p>
                <p className="text-xs text-mountain-500">
                  Showing appointments from {dateRange.start} to {dateRange.end}
                  {selectedDoctor !== "all" &&
                    ` for ${reportData.doctors.find((d) => d.id === selectedDoctor)?.name || "selected doctor"}`}
                  {selectedAppointmentType !== "all" &&
                    ` with ${reportData.appointmentTypes.find((at) => at.id === selectedAppointmentType)?.name || "selected appointment type"}`}
                </p>
              </div>

              <div className="clarity-card p-0 overflow-hidden">
                <div className="px-3 py-2 border-b border-mountain-200">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-mountain-600">
                    Appointments Details
                  </h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="clarity-table min-w-full w-full">
                    <thead>
                      <tr>
                        <th>Patient</th>
                        <th>Phone Number</th>
                        <th>Doctor</th>
                        <th>Date & Time</th>
                        <th>Status</th>
                        <th>Type</th>
                        <th>Reason</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getFilteredAppointments().map((appointment) => {
                        const patient = reportData.patients.find(
                          (p) => p.id === appointment.patientId,
                        );
                        const doctor = reportData.doctors.find(
                          (d) => d.id === appointment.doctorId,
                        );
                        const appointmentType =
                          reportData.appointmentTypes.find(
                            (at) => at.id === appointment.appointmentTypeId,
                          );
                        const statusColor =
                          appointment.status === "completed"
                            ? "success"
                            : appointment.status === "cancelled"
                              ? "danger"
                              : appointment.status === "in-progress"
                                ? "warning"
                                : "primary";

                        return (
                          <tr key={appointment.id}>
                            <td className="whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="flex-shrink-0 h-8 w-8 rounded-full bg-teal-100 flex items-center justify-center">
                                  <span className="text-xs font-medium text-teal-700">
                                    {patient?.name?.charAt(0) || "?"}
                                  </span>
                                </div>
                                <div className="ml-2">
                                  <div className="text-[13px] font-medium text-mountain-900">
                                    {patient?.name || "Unknown Patient"}
                                  </div>
                                  <div className="text-xs text-mountain-500">
                                    Reg #{patient?.regNumber || "N/A"}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="whitespace-nowrap text-[13px] text-mountain-700">
                              {patient?.phone || patient?.mobile || "N/A"}
                            </td>
                            <td>
                              <div className="text-[13px] text-mountain-700">
                                {doctor?.name || "Unknown Doctor"}
                              </div>
                              <div className="text-xs text-mountain-500">
                                {doctor?.speciality || "N/A"}
                              </div>
                            </td>
                            <td className="whitespace-nowrap">
                              <div className="text-[13px] text-mountain-900">
                                {formatDate(appointment.appointmentDate)}
                              </div>
                              <div className="text-xs text-mountain-500">
                                {formatTime(appointment.startTime)}
                              </div>
                            </td>
                            <td className="whitespace-nowrap">
                              <Chip
                                color={
                                  statusColor as
                                  | "success"
                                  | "primary"
                                  | "warning"
                                  | "danger"
                                  | "default"
                                  | "secondary"
                                }
                                size="sm"
                                variant="flat"
                              >
                                {appointment.status}
                              </Chip>
                            </td>
                            <td>
                              <div className="text-[13px] text-mountain-700">
                                {appointmentType?.name || "N/A"}
                              </div>
                              {appointmentType?.color &&
                                appointmentType.color !== "none" && (
                                  <div className="flex items-center gap-1 mt-0.5">
                                    <div
                                      className="w-2 h-2 rounded-full"
                                      style={{
                                        backgroundColor: appointmentType.color,
                                      }}
                                    />
                                    <span className="text-xs text-mountain-500 capitalize">
                                      {appointmentType.color}
                                    </span>
                                  </div>
                                )}
                            </td>
                            <td>
                              <div className="text-[13px] text-mountain-700 max-w-xs truncate">
                                {appointment.reason || "N/A"}
                              </div>
                            </td>
                            <td>
                              <div className="text-[13px] text-mountain-700 max-w-xs truncate">
                                {appointment.notes || "N/A"}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {getFilteredAppointments().length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-sm text-mountain-500">
                        No appointments found for the selected criteria.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Tab>

          <Tab
            key="patients"
            title={
              <span className="flex items-center gap-2">
                <IoPeopleOutline className="w-4 h-4" />
                Patients
                <Chip color="secondary" size="sm" variant="flat">
                  {getFilteredPatients().length}
                </Chip>
              </span>
            }
          >
            <div className="px-4 py-3">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-semibold">Patients Report</h3>
                <Button
                  color="secondary"
                  isLoading={isGenerating}
                  size="sm"
                  startContent={<IoDownloadOutline className="w-3.5 h-3.5" />}
                  onPress={exportPatientsReport}
                >
                  Export Excel
                </Button>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
                <div className="clarity-stat text-center">
                  <p className="clarity-stat-value text-health-600">
                    {getFilteredPatients().length}
                  </p>
                  <p className="clarity-stat-label">Total Patients</p>
                </div>
                <div className="clarity-stat text-center">
                  <p className="clarity-stat-value text-rose-600">
                    {getFilteredPatients().filter((p) => p.isCritical).length}
                  </p>
                  <p className="clarity-stat-label">Critical Patients</p>
                </div>
                <div className="clarity-stat text-center">
                  <p className="clarity-stat-value text-health-600">
                    {getFilteredPatients().length -
                      getFilteredPatients().filter((p) => p.isCritical).length}
                  </p>
                  <p className="clarity-stat-label">Normal Patients</p>
                </div>
                <div className="clarity-stat text-center">
                  <p className="clarity-stat-value text-teal-700">
                    {
                      getFilteredPatients().filter((p) => p.gender === "male")
                        .length
                    }
                  </p>
                  <p className="clarity-stat-label">Male Patients</p>
                </div>
                <div className="clarity-stat text-center">
                  <p className="clarity-stat-value text-pink-600">
                    {
                      getFilteredPatients().filter((p) => p.gender === "female")
                        .length
                    }
                  </p>
                  <p className="clarity-stat-label">Female Patients</p>
                </div>
              </div>
              <div className="clarity-card p-0 overflow-hidden">
                <div className="px-3 py-2 border-b border-mountain-200">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-mountain-600">
                    Patients Details
                  </h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="clarity-table min-w-full w-full">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Reg #</th>
                        <th>Visits</th>
                        <th>Gender</th>
                        <th>Age</th>
                        <th>Mobile</th>
                        <th>Email</th>
                        <th>Assigned Doctor</th>
                        <th>Critical</th>
                        <th>Registered</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getFilteredPatients().map((patient) => (
                        <tr key={patient.id}>
                          <td className="whitespace-nowrap">
                            <div className="text-[13px] font-medium text-mountain-900">
                              {patient.name}
                            </div>
                          </td>
                          <td>{patient.regNumber || "N/A"}</td>
                          <td className="whitespace-nowrap">
                            {visitsByPatientId[patient.id] ?? 0}
                          </td>
                          <td className="capitalize">
                            {patient.gender || "N/A"}
                          </td>
                          <td>{patient.age ?? "N/A"}</td>
                          <td>{patient.phone || patient.mobile || "N/A"}</td>
                          <td>{patient.email || "N/A"}</td>
                          <td>
                            {reportData.doctors.find(
                              (d) => d.id === (patient as any).doctorId,
                            )?.name || "N/A"}
                          </td>
                          <td>
                            <Chip
                              color={patient.isCritical ? "danger" : "success"}
                              size="sm"
                              variant="flat"
                            >
                              {patient.isCritical ? "Critical" : "Normal"}
                            </Chip>
                          </td>
                          <td className="whitespace-nowrap">
                            {patient.createdAt
                              ? new Date(
                                patient.createdAt as any,
                              ).toLocaleDateString()
                              : ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {getFilteredPatients().length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-sm text-mountain-500">
                        No patients found.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Tab>

          <Tab
            key="doctors"
            title={
              <span className="flex items-center gap-2">
                <IoMedicalOutline className="w-4 h-4" />
                Doctors
                <Chip color="success" size="sm" variant="flat">
                  {reportData.doctors.length}
                </Chip>
              </span>
            }
          >
            <div className="px-4 py-3">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-semibold">Doctors Report</h3>
                <Button
                  color="success"
                  isLoading={isGenerating}
                  size="sm"
                  startContent={<IoDownloadOutline className="w-3.5 h-3.5" />}
                  onPress={exportDoctorsReport}
                >
                  Export Excel
                </Button>
              </div>
              <div className="clarity-card p-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="clarity-stat text-center">
                    <p className="clarity-stat-value text-health-600">
                      {stats.activeDoctors}
                    </p>
                    <p className="clarity-stat-label">Active Doctors</p>
                  </div>
                  <div className="clarity-stat text-center">
                    <p className="clarity-stat-value text-mountain-500">
                      {reportData.doctors.length - stats.activeDoctors}
                    </p>
                    <p className="clarity-stat-label">Inactive Doctors</p>
                  </div>
                </div>
                <Divider className="my-3" />
                <h4 className="clarity-section-header">Doctor Types</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center">
                    <p className="clarity-stat-value text-teal-700">
                      {
                        reportData.doctors.filter(
                          (d) => d.doctorType === "regular",
                        ).length
                      }
                    </p>
                    <p className="clarity-stat-label">Regular Doctors</p>
                  </div>
                  <div className="text-center">
                    <p className="clarity-stat-value text-health-600">
                      {
                        reportData.doctors.filter(
                          (d) => d.doctorType === "visiting",
                        ).length
                      }
                    </p>
                    <p className="clarity-stat-label">Visiting Doctors</p>
                  </div>
                </div>
              </div>
            </div>
          </Tab>

          <Tab
            key="medicines"
            title={
              <span className="flex items-center gap-2">
                <IoMedkitSharp className="w-4 h-4" />
                Medicines
                <Chip color="warning" size="sm" variant="flat">
                  {reportData.medicines.length}
                </Chip>
              </span>
            }
          >
            <div className="px-4 py-3">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-semibold">Medicines Report</h3>
                <Button
                  color="warning"
                  isLoading={isGenerating}
                  size="sm"
                  startContent={<IoDownloadOutline className="w-3.5 h-3.5" />}
                  onPress={exportMedicinesReport}
                >
                  Export Excel
                </Button>
              </div>
              <div className="clarity-card p-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="clarity-stat text-center">
                    <p className="clarity-stat-value text-saffron-600">
                      {reportData.medicines.length}
                    </p>
                    <p className="clarity-stat-label">Total Medicines</p>
                  </div>
                  <div className="clarity-stat text-center">
                    <p className="clarity-stat-value text-health-600">
                      {reportData.medicines.filter((m) => m.isActive).length}
                    </p>
                    <p className="clarity-stat-label">Active Medicines</p>
                  </div>
                  <div className="clarity-stat text-center">
                    <p className="clarity-stat-value text-rose-600">
                      {
                        reportData.medicineStock.filter(
                          (s) => s.currentStock <= s.minimumStock,
                        ).length
                      }
                    </p>
                    <p className="clarity-stat-label">Low Stock Items</p>
                  </div>
                </div>
                <Divider className="my-3" />
                <h4 className="clarity-section-header">Stock Summary</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center">
                    <p className="clarity-stat-value text-teal-700">
                      {reportData.medicineStock.reduce(
                        (sum, stock) => sum + stock.currentStock,
                        0,
                      )}
                    </p>
                    <p className="clarity-stat-label">Total Stock Units</p>
                  </div>
                  <div className="text-center">
                    <p className="clarity-stat-value text-health-600">
                      NPR{" "}
                      {reportData.medicineStock
                        .reduce((sum, stock) => {
                          const costPrice =
                            stock.costPrice ??
                            stock.medicine?.costPrice ??
                            stock.medicine?.price ??
                            0;
                          return sum + (stock.currentStock || 0) * costPrice;
                        }, 0)
                        .toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                    </p>
                    <p className="clarity-stat-label">Total Inventory Value</p>
                  </div>
                </div>
              </div>
            </div>
          </Tab>

          <Tab
            key="pathology"
            title={
              <span className="flex items-center gap-2">
                <IoStatsChartOutline className="w-4 h-4" />
                Pathology
                <Chip color="primary" size="sm" variant="flat">
                  {filteredPathologyBillings.length}
                </Chip>
              </span>
            }
          >
            <div className="px-4 py-3">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-semibold">Pathology Report</h3>
                <Button
                  color="primary"
                  isDisabled={!filteredPathologyBillings.length}
                  isLoading={isGenerating}
                  size="sm"
                  startContent={<IoDownloadOutline className="w-3.5 h-3.5" />}
                  onPress={exportPathologyReport}
                >
                  Export Excel
                </Button>
              </div>
              <div className="clarity-card p-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="clarity-stat text-center">
                    <p className="clarity-stat-value text-health-600">
                      NPR{" "}
                      {filteredPathologyBillings
                        .reduce((sum, b) => sum + (b.totalAmount || 0), 0)
                        .toLocaleString()}
                    </p>
                    <p className="clarity-stat-label">Total Revenue</p>
                  </div>
                  <div className="clarity-stat text-center">
                    <p className="clarity-stat-value text-saffron-600">
                      NPR{" "}
                      {filteredPathologyBillings
                        .reduce((sum, b) => sum + (b.paidAmount || 0), 0)
                        .toLocaleString()}
                    </p>
                    <p className="clarity-stat-label">Total Collected</p>
                  </div>
                  <div className="clarity-stat text-center">
                    <p className="clarity-stat-value text-teal-700">
                      {filteredPathologyBillings.length}
                    </p>
                    <p className="clarity-stat-label">Total Invoices</p>
                  </div>
                </div>
                <Divider className="my-3" />
                <h4 className="clarity-section-header">Payment Status</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <p className="clarity-stat-value text-health-600">
                      {
                        filteredPathologyBillings.filter(
                          (p) => p.paymentStatus === "paid",
                        ).length
                      }
                    </p>
                    <p className="clarity-stat-label">Paid</p>
                  </div>
                  <div className="text-center">
                    <p className="clarity-stat-value text-saffron-600">
                      {
                        filteredPathologyBillings.filter(
                          (p) => p.paymentStatus === "partial",
                        ).length
                      }
                    </p>
                    <p className="clarity-stat-label">Partial</p>
                  </div>
                  <div className="text-center">
                    <p className="clarity-stat-value text-rose-600">
                      {
                        filteredPathologyBillings.filter(
                          (p) => p.paymentStatus === "unpaid",
                        ).length
                      }
                    </p>
                    <p className="clarity-stat-label">Unpaid</p>
                  </div>
                </div>
              </div>

              <div className="clarity-card p-0 mt-4 overflow-hidden">
                <div className="px-3 py-2 border-b border-mountain-200">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-mountain-600">
                    Invoice Details
                  </h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="clarity-table min-w-full w-full">
                    <thead>
                      <tr>
                        <th>Invoice No</th>
                        <th>Date</th>
                        <th>Patient</th>
                        <th>Items</th>
                        <th>Total Amount</th>
                        <th>Discount</th>
                        <th>Net Amount</th>
                        <th>Paid Amount</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPathologyBillings.map((billing) => {
                        const date = billing.invoiceDate
                          ? new Date(billing.invoiceDate).toLocaleDateString()
                          : "N/A";
                        const time = billing.invoiceDate
                          ? new Date(billing.invoiceDate).toLocaleTimeString(
                            [],
                            { hour: "2-digit", minute: "2-digit" },
                          )
                          : "";
                        const itemsCount = billing.items?.length || 0;

                        const statusColor =
                          billing.paymentStatus === "paid"
                            ? "success"
                            : billing.paymentStatus === "partial"
                              ? "warning"
                              : "danger";

                        return (
                          <tr
                            key={billing.id}
                            className="cursor-pointer hover:bg-default-100 transition-colors"
                            onClick={() => navigate("/dashboard/pathology")}
                          >
                            <td className="whitespace-nowrap font-medium text-[13px]">
                              {billing.invoiceNumber || "N/A"}
                            </td>
                            <td className="whitespace-nowrap">
                              <div className="text-[13px] text-mountain-700">
                                {date}
                              </div>
                              <div className="text-xs text-mountain-500">
                                {time}
                              </div>
                            </td>
                            <td>
                              <div className="text-[13px] font-medium text-mountain-900">
                                {billing.patientName || "Unknown"}
                              </div>
                              {billing.patientPhone && (
                                <div className="text-xs text-mountain-500">
                                  {billing.patientPhone}
                                </div>
                              )}
                            </td>
                            <td>
                              <div className="text-[13px]">
                                {itemsCount} test{itemsCount !== 1 ? "s" : ""}
                              </div>
                            </td>
                            <td className="text-[13px]">
                              NPR {(billing.subtotal || 0).toLocaleString()}
                            </td>
                            <td className="text-[13px]">
                              {(billing.discountAmount || 0) > 0
                                ? `NPR ${(billing.discountAmount || 0).toLocaleString()}`
                                : "-"}
                            </td>
                            <td className="text-[13px] font-medium">
                              NPR {(billing.totalAmount || 0).toLocaleString()}
                            </td>
                            <td className="text-[13px] text-health-600">
                              NPR {(billing.paidAmount || 0).toLocaleString()}
                            </td>
                            <td>
                              <Chip
                                className="capitalize"
                                color={statusColor as any}
                                size="sm"
                                variant="flat"
                              >
                                {billing.paymentStatus || "Unpaid"}
                              </Chip>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredPathologyBillings.length === 0 && (
                        <tr>
                          <td
                            className="text-center py-6 text-mountain-500"
                            colSpan={9}
                          >
                            No invoice records found for the selected criteria.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </Tab>

          <Tab
            key="pharmacy"
            title={
              <span className="flex items-center gap-2">
                <IoStorefrontOutline className="w-4 h-4" />
                Pharmacy
                <Chip color="secondary" size="sm" variant="flat">
                  {filteredPharmacyPurchases.length}
                </Chip>
              </span>
            }
          >
            <div className="px-4 py-3">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-semibold">Pharmacy Report</h3>
                <Button
                  color="secondary"
                  isLoading={isGenerating}
                  size="sm"
                  startContent={<IoDownloadOutline className="w-3.5 h-3.5" />}
                  onPress={exportPharmacyReport}
                >
                  Export Excel
                </Button>
              </div>
              <div className="clarity-card p-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="clarity-stat text-center">
                    <p className="clarity-stat-value text-health-600">
                      {filteredPharmacyPurchases.length}
                    </p>
                    <p className="clarity-stat-label">Total Purchases</p>
                  </div>
                  <div className="clarity-stat text-center">
                    <p className="clarity-stat-value text-health-600">
                      NPR{" "}
                      {filteredPharmacyPurchases
                        .reduce((sum, purchase) => sum + purchase.netAmount, 0)
                        .toLocaleString()}
                    </p>
                    <p className="clarity-stat-label">Total Purchase Value</p>
                  </div>
                  <div className="clarity-stat text-center">
                    <p className="clarity-stat-value text-saffron-600">
                      {filteredPharmacyUsage.length}
                    </p>
                    <p className="clarity-stat-label">Medicine Usage Records</p>
                  </div>
                </div>
                <Divider className="my-3" />
                <h4 className="clarity-section-header">Payment Status</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <p className="clarity-stat-value text-health-600">
                      {
                        filteredPharmacyPurchases.filter(
                          (p) => p.paymentStatus === "paid",
                        ).length
                      }
                    </p>
                    <p className="clarity-stat-label">Paid</p>
                  </div>
                  <div className="text-center">
                    <p className="clarity-stat-value text-saffron-600">
                      {
                        filteredPharmacyPurchases.filter(
                          (p) => p.paymentStatus === "partial",
                        ).length
                      }
                    </p>
                    <p className="clarity-stat-label">Partial</p>
                  </div>
                  <div className="text-center">
                    <p className="clarity-stat-value text-rose-600">
                      {
                        filteredPharmacyPurchases.filter(
                          (p) => p.paymentStatus === "pending",
                        ).length
                      }
                    </p>
                    <p className="clarity-stat-label">Pending</p>
                  </div>
                </div>
              </div>

              <div className="clarity-card p-0 mt-4 overflow-hidden">
                <div className="px-3 py-2 border-b border-mountain-200">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-mountain-600">
                    Purchase Details
                  </h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="clarity-table min-w-full w-full">
                    <thead>
                      <tr>
                        <th>Purchase No</th>
                        <th>Date</th>
                        <th>Patient/Customer</th>
                        <th>Items</th>
                        <th>Total</th>
                        <th>Discount</th>
                        <th>Tax</th>
                        <th>Net Amount</th>
                        <th>Status</th>
                        <th>Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPharmacyPurchases.map((purchase) => {
                        const pDate =
                          purchase.purchaseDate || (purchase as any).createdAt;
                        const date = pDate
                          ? new Date(pDate).toLocaleDateString()
                          : "N/A";
                        const time = pDate
                          ? new Date(pDate).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                          : "";
                        const itemsCount = purchase.items?.length || 0;
                        const totalQty =
                          purchase.items?.reduce(
                            (s, i) => s + (i.quantity || 0),
                            0,
                          ) || 0;

                        const statusColor =
                          purchase.paymentStatus === "paid"
                            ? "success"
                            : purchase.paymentStatus === "partial"
                              ? "warning"
                              : "danger";

                        return (
                          <tr
                            key={purchase.id}
                            className="cursor-pointer hover:bg-default-100 transition-colors"
                            onClick={() =>
                              navigate(
                                `/dashboard/pharmacy/purchase/${purchase.id}`,
                              )
                            }
                          >
                            <td className="whitespace-nowrap font-medium text-[13px]">
                              {purchase.purchaseNo || "N/A"}
                            </td>
                            <td className="whitespace-nowrap">
                              <div className="text-[13px] text-mountain-700">
                                {date}
                              </div>
                              <div className="text-xs text-mountain-500">
                                {time}
                              </div>
                            </td>
                            <td>
                              <div className="text-[13px] font-medium text-mountain-900">
                                {purchase.patientName ||
                                  (purchase as any).customerName ||
                                  "Walk-in Customer"}
                              </div>
                              {(purchase.patientPhone ||
                                (purchase as any).customerPhone) && (
                                  <div className="text-xs text-mountain-500">
                                    {purchase.patientPhone ||
                                      (purchase as any).customerPhone}
                                  </div>
                                )}
                            </td>
                            <td>
                              <div className="text-[13px]">
                                {itemsCount} item{itemsCount !== 1 ? "s" : ""}
                              </div>
                              <div className="text-xs text-mountain-500">
                                Qty: {totalQty}
                              </div>
                            </td>
                            <td className="text-[13px]">
                              NPR {(purchase.total || 0).toLocaleString()}
                            </td>
                            <td className="text-[13px]">
                              {(purchase.discount || 0) > 0
                                ? `NPR ${(purchase.discount || 0).toLocaleString()}`
                                : "-"}
                            </td>
                            <td className="text-[13px]">
                              {(purchase.taxAmount || 0) > 0
                                ? `NPR ${(purchase.taxAmount || 0).toLocaleString()}`
                                : "-"}
                            </td>
                            <td className="text-[13px] font-medium">
                              NPR {(purchase.netAmount || 0).toLocaleString()}
                            </td>
                            <td>
                              <Chip
                                className="capitalize"
                                color={statusColor as any}
                                size="sm"
                                variant="flat"
                              >
                                {purchase.paymentStatus || "Unknown"}
                              </Chip>
                            </td>
                            <td className="text-[13px] capitalize">
                              {purchase.paymentType || "Cash"}
                            </td>
                          </tr>
                        );
                      })}
                      {filteredPharmacyPurchases.length === 0 && (
                        <tr>
                          <td
                            className="text-center py-6 text-mountain-500"
                            colSpan={10}
                          >
                            No purchase records found for the selected criteria.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </Tab>

          {reportData.billingSettings &&
            reportData.billingSettings.enabledByAdmin &&
            reportData.billingSettings.isActive && (
              <Tab
                key="billing"
                title={
                  <span className="flex items-center gap-2">
                    <IoReceiptOutline className="w-4 h-4" />
                    Billing
                    <Chip color="primary" size="sm" variant="flat">
                      {filteredBillings.length}
                    </Chip>
                  </span>
                }
              >
                <div className="px-4 py-3">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm font-semibold">Billing Report</h3>
                    <Button
                      color="primary"
                      isDisabled={!reportData.billings.length}
                      isLoading={isGenerating}
                      size="sm"
                      startContent={
                        <IoDownloadOutline className="w-3.5 h-3.5" />
                      }
                      onPress={exportBillingReport}
                    >
                      Export Excel
                    </Button>
                  </div>
                  <div className="clarity-card p-3">
                    {(() => {
                      let totalRevenue = 0;
                      let totalPaid = 0;

                      // Appointment Billing Revenue & Collection
                      filteredBillings.forEach((b) => {
                        if (
                          selectedDoctor === "all" &&
                          selectedAppointmentType === "all"
                        ) {
                          totalRevenue += b.totalAmount;
                          totalPaid += b.paidAmount || 0;
                        } else {
                          const itemsTotal =
                            b.items.reduce((s, i) => s + (i.amount || 0), 0) ||
                            b.subtotal ||
                            1;
                          const revenueScale = b.totalAmount / itemsTotal;
                          const paidScale = (b.paidAmount || 0) / itemsTotal;

                          b.items.forEach((item) => {
                            const matchesDoctor =
                              selectedDoctor === "all" ||
                              (item.doctorId || b.doctorId) === selectedDoctor;
                            const matchesType =
                              selectedAppointmentType === "all" ||
                              item.appointmentTypeId ===
                              selectedAppointmentType;

                            if (matchesDoctor && matchesType) {
                              totalRevenue += (item.amount || 0) * revenueScale;
                              totalPaid += (item.amount || 0) * paidScale;
                            }
                          });
                        }
                      });

                      // Pathology Billing Revenue & Collection (only applies if selectedAppointmentType is "all")
                      if (selectedAppointmentType === "all") {
                        if (selectedDoctor === "all") {
                          totalRevenue += filteredPathologyBillings.reduce(
                            (sum, b) => sum + (b.totalAmount || 0),
                            0,
                          );
                          totalPaid += filteredPathologyBillings.reduce(
                            (sum, b) => sum + (b.paidAmount || 0),
                            0,
                          );
                        } else {
                          filteredPathologyBillings.forEach((b) => {
                            const referral = b.referringDoctors?.find(
                              (rd) => rd.doctorId === selectedDoctor,
                            );

                            if (referral) {
                              totalRevenue += referral.calculatedAmount;
                              const share =
                                referral.calculatedAmount / b.totalAmount;

                              totalPaid += (b.paidAmount || 0) * share;
                            }
                          });
                        }
                      }

                      const outstandingBalance = Math.max(
                        0,
                        totalRevenue - totalPaid,
                      );

                      return (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                          <div className="clarity-stat text-center">
                            <p className="clarity-stat-value text-teal-700">
                              {filteredBillings.length}
                            </p>
                            <p className="clarity-stat-label">Total Invoices</p>
                          </div>
                          <div className="clarity-stat text-center">
                            <p className="clarity-stat-value text-health-600">
                              NPR {Math.round(totalRevenue).toLocaleString()}
                            </p>
                            <p className="clarity-stat-label">Total Revenue</p>
                          </div>
                          <div className="clarity-stat text-center">
                            <p className="clarity-stat-value text-saffron-600">
                              NPR {Math.round(totalPaid).toLocaleString()}
                            </p>
                            <p className="clarity-stat-label">
                              Total Collected
                            </p>
                          </div>
                          <div className="clarity-stat text-center">
                            <p className="clarity-stat-value text-rose-600">
                              NPR{" "}
                              {Math.round(outstandingBalance).toLocaleString()}
                            </p>
                            <p className="clarity-stat-label">
                              Outstanding Balance
                            </p>
                          </div>
                        </div>
                      );
                    })()}
                    <Divider className="my-3" />
                    <h4 className="clarity-section-header">Payment Status</h4>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="text-center">
                        <p className="clarity-stat-value text-health-600">
                          {
                            filteredBillings.filter(
                              (b) => b.paymentStatus === "paid",
                            ).length
                          }
                        </p>
                        <p className="clarity-stat-label">Paid</p>
                      </div>
                      <div className="text-center">
                        <p className="clarity-stat-value text-saffron-600">
                          {
                            filteredBillings.filter(
                              (b) => b.paymentStatus === "partial",
                            ).length
                          }
                        </p>
                        <p className="clarity-stat-label">Partial</p>
                      </div>
                      <div className="text-center">
                        <p className="clarity-stat-value text-rose-600">
                          {
                            filteredBillings.filter(
                              (b) => b.paymentStatus === "unpaid",
                            ).length
                          }
                        </p>
                        <p className="clarity-stat-label">Unpaid</p>
                      </div>
                    </div>
                    <Divider className="my-3" />
                    <h4 className="clarity-section-header">Invoice Status</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="text-center">
                        <p className="clarity-stat-value text-mountain-600">
                          {
                            filteredBillings.filter((b) => b.status === "draft")
                              .length
                          }
                        </p>
                        <p className="clarity-stat-label">Draft</p>
                      </div>
                      <div className="text-center">
                        <p className="clarity-stat-value text-teal-700">
                          {
                            filteredBillings.filter(
                              (b) => b.status === "finalized",
                            ).length
                          }
                        </p>
                        <p className="clarity-stat-label">Finalized</p>
                      </div>
                      <div className="text-center">
                        <p className="clarity-stat-value text-health-600">
                          {
                            filteredBillings.filter((b) => b.status === "paid")
                              .length
                          }
                        </p>
                        <p className="clarity-stat-label">Paid</p>
                      </div>
                      <div className="text-center">
                        <p className="clarity-stat-value text-rose-600">
                          {
                            filteredBillings.filter(
                              (b) => b.status === "cancelled",
                            ).length
                          }
                        </p>
                        <p className="clarity-stat-label">Cancelled</p>
                      </div>
                    </div>
                    <Divider className="my-3" />
                    <h4 className="clarity-section-header">Doctor Analysis</h4>
                    {(() => {
                      // Build per-doctor revenue and invoice sets
                      const doctorStats = new Map<
                        string,
                        { name: string; invoices: Set<string>; revenue: number }
                      >();

                      filteredBillings.forEach((b) => {
                        const itemsTotal =
                          b.items.reduce((s, i) => s + (i.amount || 0), 0) ||
                          b.subtotal ||
                          1;
                        const scaleFactor =
                          itemsTotal > 0 ? b.totalAmount / itemsTotal : 1;

                        b.items.forEach((item) => {
                          if (
                            selectedAppointmentType !== "all" &&
                            item.appointmentTypeId !== selectedAppointmentType
                          ) {
                            return;
                          }
                          const dId = item.doctorId || b.doctorId;
                          const dName =
                            item.doctorName || b.doctorName || "Unknown";

                          if (!dId) return;
                          if (!doctorStats.has(dId)) {
                            doctorStats.set(dId, {
                              name: dName,
                              invoices: new Set(),
                              revenue: 0,
                            });
                          }
                          const stats = doctorStats.get(dId)!;

                          stats.revenue += (item.amount || 0) * scaleFactor;
                          stats.invoices.add(b.id);
                        });

                        if (b.referrals && b.referrals.length > 0) {
                          b.referrals.forEach((ref) => {
                            if (!doctorStats.has(ref.id)) {
                              doctorStats.set(ref.id, {
                                name: ref.name || "Partner",
                                invoices: new Set(),
                                revenue: 0,
                              });
                            }
                            const stats = doctorStats.get(ref.id)!;

                            stats.revenue += ref.commissionAmount || 0;
                            stats.invoices.add(b.id);
                          });
                        } else if (
                          b.referralPartnerId &&
                          b.referralCommissionAmount
                        ) {
                          if (!doctorStats.has(b.referralPartnerId)) {
                            const partnerName =
                              reportData.referralPartners.find(
                                (p) => p.id === b.referralPartnerId,
                              )?.name || "Partner";

                            doctorStats.set(b.referralPartnerId, {
                              name: partnerName,
                              invoices: new Set(),
                              revenue: 0,
                            });
                          }
                          const stats = doctorStats.get(b.referralPartnerId)!;

                          stats.revenue += b.referralCommissionAmount;
                          stats.invoices.add(b.id);
                        }
                      });

                      filteredPathologyBillings.forEach((b) => {
                        // For pathology, we use the referringDoctors array
                        if (
                          b.referringDoctors &&
                          b.referringDoctors.length > 0
                        ) {
                          b.referringDoctors.forEach((rd) => {
                            if (!doctorStats.has(rd.doctorId)) {
                              doctorStats.set(rd.doctorId, {
                                name: rd.doctorName,
                                invoices: new Set(),
                                revenue: 0,
                              });
                            }
                            const stats = doctorStats.get(rd.doctorId)!;

                            stats.revenue += rd.calculatedAmount;
                            stats.invoices.add(b.id);
                          });
                        }
                      });

                      const doctorList = Array.from(doctorStats.entries())
                        .map(([id, data]) => ({ id, ...data }))
                        .sort((a, b) => b.revenue - a.revenue);

                      return (
                        <>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {(showAllDoctorsAnalysis
                              ? doctorList
                              : doctorList.slice(0, 6)
                            ).map((doc) => (
                              <div
                                key={doc.id}
                                className="clarity-stat text-center"
                              >
                                <p className="clarity-stat-value text-mountain-900">
                                  NPR {Math.round(doc.revenue).toLocaleString()}
                                </p>
                                <p className="text-xs text-mountain-600">
                                  {doc.name}
                                </p>
                                <p className="text-[11px] text-mountain-500">
                                  {doc.invoices.size} invoice
                                  {doc.invoices.size !== 1 ? "s" : ""}
                                </p>
                              </div>
                            ))}
                          </div>
                          {doctorList.length > 6 && (
                            <div className="flex justify-center mt-3">
                              <Button
                                className="text-mountain-500 text-sm"
                                size="sm"
                                variant="light"
                                onPress={() =>
                                  setShowAllDoctorsAnalysis(
                                    !showAllDoctorsAnalysis,
                                  )
                                }
                              >
                                {showAllDoctorsAnalysis
                                  ? "Show less"
                                  : `+${doctorList.length - 6} more doctors`}
                              </Button>
                            </div>
                          )}
                        </>
                      );
                    })()}
                    <Divider className="my-3" />
                    <h4 className="clarity-section-header">Revenue Trends</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="text-center">
                        <p className="clarity-stat-value text-teal-700">
                          NPR{" "}
                          {(
                            filteredBillings.reduce(
                              (sum, b) => sum + b.totalAmount,
                              0,
                            ) / Math.max(filteredBillings.length, 1)
                          ).toLocaleString()}
                        </p>
                        <p className="clarity-stat-label">
                          Average Invoice Value
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="clarity-stat-value text-health-600">
                          {filteredBillings.reduce(
                            (sum, b) => sum + b.items.length,
                            0,
                          )}
                        </p>
                        <p className="clarity-stat-label">Total Items Billed</p>
                      </div>
                    </div>
                  </div>

                  <div className="clarity-card p-0 mt-4 overflow-hidden">
                    <div className="px-3 py-2 border-b border-mountain-200">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-mountain-600">
                        Invoice Details
                      </h4>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="clarity-table min-w-full w-full">
                        <thead>
                          <tr>
                            <th>Invoice No</th>
                            <th>Date</th>
                            <th>Patient</th>
                            <th>Doctor</th>
                            <th>Items</th>
                            <th>Total</th>
                            <th>Discount</th>
                            <th>Tax</th>
                            <th>Paid Amount</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredBillings.map((billing) => {
                            const date = billing.invoiceDate
                              ? new Date(
                                billing.invoiceDate,
                              ).toLocaleDateString()
                              : "N/A";
                            const time = billing.invoiceDate
                              ? new Date(
                                billing.invoiceDate,
                              ).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                              : "";
                            const itemsCount = billing.items?.length || 0;

                            const statusColor =
                              billing.paymentStatus === "paid"
                                ? "success"
                                : billing.paymentStatus === "partial"
                                  ? "warning"
                                  : "danger";

                            return (
                              <tr
                                key={billing.id}
                                className="cursor-pointer hover:bg-default-100 transition-colors"
                                onClick={() =>
                                  navigate(`/dashboard/billing/${billing.id}`)
                                }
                              >
                                <td className="whitespace-nowrap font-medium text-[13px]">
                                  {billing.invoiceNumber || "N/A"}
                                </td>
                                <td className="whitespace-nowrap">
                                  <div className="text-[13px] text-mountain-700">
                                    {date}
                                  </div>
                                  <div className="text-xs text-mountain-500">
                                    {time}
                                  </div>
                                </td>
                                <td>
                                  <div className="text-[13px] font-medium text-mountain-900">
                                    {billing.patientName || "Unknown"}
                                  </div>
                                </td>
                                <td>
                                  <div className="text-[13px] font-medium text-mountain-900">
                                    {billing.doctorName || "Unknown"}
                                  </div>
                                </td>
                                <td>
                                  <div className="text-[13px]">
                                    {itemsCount} item
                                    {itemsCount !== 1 ? "s" : ""}
                                  </div>
                                </td>
                                <td className="text-[13px] font-medium">
                                  NPR{" "}
                                  {(billing.totalAmount || 0).toLocaleString()}
                                </td>
                                <td className="text-[13px]">
                                  {(billing.discountAmount || 0) > 0
                                    ? `NPR ${(billing.discountAmount || 0).toLocaleString()}`
                                    : "-"}
                                </td>
                                <td className="text-[13px]">
                                  {(billing.taxAmount || 0) > 0
                                    ? `NPR ${(billing.taxAmount || 0).toLocaleString()}`
                                    : "-"}
                                </td>
                                <td className="text-[13px] text-health-600">
                                  NPR{" "}
                                  {(billing.paidAmount || 0).toLocaleString()}
                                </td>
                                <td>
                                  <Chip
                                    className="capitalize"
                                    color={statusColor as any}
                                    size="sm"
                                    variant="flat"
                                  >
                                    {billing.paymentStatus || "Unpaid"}
                                  </Chip>
                                </td>
                              </tr>
                            );
                          })}
                          {filteredBillings.length === 0 && (
                            <tr>
                              <td
                                className="text-center py-6 text-mountain-500"
                                colSpan={10}
                              >
                                No invoice records found for the selected
                                criteria.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </Tab>
            )}

          <Tab
            key="inventory"
            title={
              <span className="flex items-center gap-2">
                <IoLayersOutline className="w-4 h-4" />
                Inventory
                <Chip color="default" size="sm" variant="flat">
                  {reportData.items.length}
                </Chip>
              </span>
            }
          >
            <div className="px-4 py-3">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-semibold">Inventory Report</h3>
                <Button
                  color="default"
                  isLoading={isGenerating}
                  size="sm"
                  startContent={<IoDownloadOutline className="w-3.5 h-3.5" />}
                  onPress={exportInventoryReport}
                >
                  Export Excel
                </Button>
              </div>
              <div className="clarity-card p-3">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="clarity-stat text-center">
                    <p className="clarity-stat-value text-mountain-700">
                      {reportData.items.length}
                    </p>
                    <p className="clarity-stat-label">Total Items</p>
                  </div>
                  <div className="clarity-stat text-center">
                    <p className="clarity-stat-value text-teal-700">
                      {reportData.itemCategories.length}
                    </p>
                    <p className="clarity-stat-label">Categories</p>
                  </div>
                  <div className="clarity-stat text-center">
                    <p className="clarity-stat-value text-saffron-600">
                      {reportData.issuedItems.length}
                    </p>
                    <p className="clarity-stat-label">Issued Items</p>
                  </div>
                  <div className="clarity-stat text-center">
                    <p className="clarity-stat-value text-health-600">
                      {reportData.items.reduce(
                        (sum, item) => sum + (item.quantity || 0),
                        0,
                      )}
                    </p>
                    <p className="clarity-stat-label">Total Quantity</p>
                  </div>
                </div>
                <Divider className="my-3" />
                <h4 className="clarity-section-header">Inventory Analysis</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="text-center">
                    <p className="clarity-stat-value text-teal-700">
                      {reportData.items.filter((item) => item.isActive).length}
                    </p>
                    <p className="clarity-stat-label">Active Items</p>
                  </div>
                  <div className="text-center">
                    <p className="clarity-stat-value text-health-600">
                      {reportData.items.filter((item) => item.barcode).length}
                    </p>
                    <p className="clarity-stat-label">Barcoded Items</p>
                  </div>
                  <div className="text-center">
                    <p className="clarity-stat-value text-saffron-600">
                      {
                        reportData.items.filter(
                          (item) => (item.quantity || 0) === 0,
                        ).length
                      }
                    </p>
                    <p className="clarity-stat-label">Out of Stock</p>
                  </div>
                  <div className="text-center">
                    <p className="clarity-stat-value text-rose-600">
                      {
                        reportData.issuedItems.filter(
                          (item) => item.status === "overdue",
                        ).length
                      }
                    </p>
                    <p className="clarity-stat-label">Overdue Returns</p>
                  </div>
                </div>
                <Divider className="my-3" />
                <h4 className="clarity-section-header">Category Breakdown</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {(showAllCategories
                    ? reportData.itemCategories
                    : reportData.itemCategories.slice(0, 6)
                  ).map((category) => {
                    const categoryItems = reportData.items.filter(
                      (item) => item.category === category.name,
                    );

                    return (
                      <div
                        key={category.id}
                        className="clarity-stat text-center"
                      >
                        <p className="clarity-stat-value text-mountain-900">
                          {categoryItems.length}
                        </p>
                        <p className="text-xs text-mountain-600">
                          {category.name}
                        </p>
                      </div>
                    );
                  })}
                </div>
                {reportData.itemCategories.length > 6 && (
                  <div className="flex justify-center mt-3">
                    <Button
                      className="text-mountain-500 text-sm"
                      size="sm"
                      variant="light"
                      onPress={() => setShowAllCategories(!showAllCategories)}
                    >
                      {showAllCategories
                        ? "Show less"
                        : `+${reportData.itemCategories.length - 6} more categories`}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </Tab>
        </Tabs>
      </div>
    </div>
  );
}
