import { useState, useEffect } from "react";
import {
  useParams,
  useNavigate,
  Link,
  useSearchParams,
} from "react-router-dom";
import {
  IoArrowBackOutline,
  IoCalendarOutline,
  IoCreateOutline,
  IoMedicalOutline,
  IoDocumentTextOutline,
  IoInformationCircleOutline,
  IoWarningOutline,
  IoWalletOutline,
  IoReceiptOutline,
  IoPrintOutline,
} from "react-icons/io5";

import { useAuth } from "@/hooks/useAuth";
import { patientService } from "@/services/patientService";
import { appointmentBillingService } from "@/services/appointmentBillingService";
import { appointmentService } from "@/services/appointmentService";
import { prescriptionService } from "@/services/prescriptionService";
import { clinicService } from "@/services/clinicService";
import { doctorService } from "@/services/doctorService";
import { expertService } from "@/services/expertService";
import { MedicalRecordsService } from "@/services/medicalRecordsService";
import { PatientNoteEntriesService } from "@/services/patientNoteEntriesService";
import { MedicalReportResponseService } from "@/services/medicalReportResponseService";
import { medicalReportFieldService } from "@/services/medicalReportFieldService";
import {
  getPrintBrandingCSS,
  getPrintHeaderHTML,
  getPrintFooterHTML,
} from "@/utils/printBranding";
import { Patient } from "@/types/models";
// ── Custom UI (zero HeroUI) ───────────────────────────────────────────────────
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Divider } from "@/components/ui/divider";
import { addToast } from "@/components/ui/toast";
import { title } from "@/components/primitives";

// Import tab components
import PatientOverviewTab from "@/components/patients/PatientOverviewTab";
import PatientAppointmentsTab from "@/components/patients/PatientAppointmentsTab";
import PatientMedicalRecordsTab from "@/components/patients/PatientMedicalRecordsTab";
import { PatientMedicalReportTab } from "@/components/patients/PatientMedicalReportTab";
import PatientNotesTab from "@/components/patients/PatientNotesTab";
import PatientBillingTab from "@/components/patients/PatientBillingTab";
import PatientPrescriptionsTab from "@/components/patients/PatientPrescriptionsTab";
import PatientWalletTab from "@/components/patients/PatientWalletTab";

export default function PatientDetailPage() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const { clinicId, currentUser, userData, isLoading: authLoading } = useAuth();

  const [searchParams, setSearchParams] = useSearchParams();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState(
    searchParams.get("tab") || "overview",
  );
  const [isBillingEnabled, setIsBillingEnabled] = useState(false);
  const [isGeneratingPrint, setIsGeneratingPrint] = useState(false);

  // Update selectedTab if URL changes (e.g. back button)
  useEffect(() => {
    const tabFromUrl = searchParams.get("tab");

    if (tabFromUrl && tabFromUrl !== selectedTab) {
      setSelectedTab(tabFromUrl);
    } else if (!tabFromUrl && selectedTab !== "overview") {
      setSelectedTab("overview");
    }
  }, [searchParams]);

  // Update URL when tab is selected
  const handleTabChange = (tabKey: string) => {
    setSelectedTab(tabKey);
    setSearchParams({ tab: tabKey });
  };

  useEffect(() => {
    loadPatient();
    checkBillingSettings();
  }, [patientId, clinicId]);

  const loadPatient = async () => {
    if (!patientId || !clinicId) return;

    try {
      setLoading(true);
      const patientData = await patientService.getPatientById(patientId);

      // Authorization Check: Doctors should only view patients assigned to them
      const isAdmin =
        userData?.role === "clinic-admin" || userData?.role === "system-owner";

      if (!isAdmin && userData?.email) {
        try {
          const docInfo = await doctorService.getDoctorByEmail(userData.email);

          if (docInfo && patientData && patientData.doctorId !== docInfo.id) {
            addToast({
              title: "Access Denied",
              description:
                "You are only authorized to view patients assigned to you.",
              color: "danger",
            });
            navigate("/dashboard/patients");

            return;
          }
        } catch (e) {
          console.error("Linkage check failed:", e);
        }
      }

      setPatient(patientData);
    } catch (error) {
      console.error("Error loading patient:", error);
      addToast({
        title: "Error",
        description: "Failed to load patient information.",
        color: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  const checkBillingSettings = async () => {
    if (!clinicId) return;

    try {
      const settings =
        await appointmentBillingService.getBillingSettings(clinicId);

      setIsBillingEnabled(settings?.enabledByAdmin && settings?.isActive);
    } catch (error) {
      console.error("Error checking billing settings:", error);
      setIsBillingEnabled(false);
    }
  };

  // Calculate age from date of birth
  const calculateAge = (dob: Date | any): string => {
    if (!dob) return "";
    const b = new Date(dob);

    if (isNaN(b.getTime())) return "";
    const t = new Date();

    let years = t.getFullYear() - b.getFullYear();
    let months = t.getMonth() - b.getMonth();
    let days = t.getDate() - b.getDate();

    if (days < 0) {
      months--;
      const prevMonth = new Date(t.getFullYear(), t.getMonth(), 0).getDate();

      days += prevMonth;
    }
    if (months < 0) {
      years--;
      months += 12;
    }

    if (years > 0) return `${years} Year${years > 1 ? "s" : ""}`;
    if (months > 0) return `${months} Month${months > 1 ? "s" : ""}`;
    if (days > 0) return `${days} Day${days > 1 ? "s" : ""}`;

    return "0 Days";
  };

  // Format date for display
  const formatDate = (date: Date | any): string => {
    const d = new Date(date);

    if (isNaN(d.getTime())) return "Invalid Date";

    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Generate comprehensive patient print
  const handlePrintAll = async () => {
    if (!patient || !clinicId) {
      addToast({
        title: "Error",
        description: "Patient information not available for printing.",
        color: "danger",
      });

      return;
    }

    setIsGeneratingPrint(true);

    try {
      // Gather all patient data with error handling for each service
      const results = await Promise.allSettled([
        clinicService.getClinicById(clinicId),
        clinicService.getPrintLayoutConfig(clinicId),
        doctorService.getDoctorsByClinic(clinicId).catch((err) => {
          console.warn("Failed to fetch doctors:", err);

          return [];
        }),
        appointmentService
          .getAppointmentsByClinic(clinicId)
          .then((all) => all.filter((apt) => apt.patientId === patientId))
          .catch((err) => {
            console.warn("Failed to fetch appointments:", err);

            return [];
          }),
        prescriptionService
          .getPrescriptionsByPatient(patientId)
          .then(async (prescriptions) => {
            // Fetch prescription items for each prescription
            const prescriptionsWithItems = await Promise.all(
              prescriptions.map(async (prescription) => {
                try {
                  const items = await prescriptionService.getPrescriptionItems(
                    prescription.id,
                  );

                  return { ...prescription, items };
                } catch (err) {
                  console.warn(
                    `Failed to fetch items for prescription ${prescription.id}:`,
                    err,
                  );

                  return { ...prescription, items: [] };
                }
              }),
            );

            return prescriptionsWithItems;
          })
          .catch((err) => {
            console.warn("Failed to fetch prescriptions:", err);

            return [];
          }),
        MedicalRecordsService.getDocumentsByPatient(patientId, clinicId).catch(
          (err) => {
            console.warn("Failed to fetch documents:", err);

            return [];
          },
        ),
        MedicalRecordsService.getXraysByPatient(patientId, clinicId).catch(
          (err) => {
            console.warn("Failed to fetch X-rays:", err);

            return [];
          },
        ),
        PatientNoteEntriesService.getPatientNoteEntries(
          clinicId,
          patientId,
        ).catch((err) => {
          console.warn("Failed to fetch note entries:", err);

          return [];
        }),
        MedicalReportResponseService.getPatientResponses(
          clinicId,
          patientId,
        ).catch((err) => {
          console.warn("Failed to fetch medical report responses:", err);

          return null;
        }),
        medicalReportFieldService.getFields(clinicId).catch((err) => {
          console.warn("Failed to fetch medical report fields:", err);

          return [];
        }),
          isBillingEnabled
            ? appointmentBillingService
                .getBillingByPatient(patientId, clinicId)
                .catch((err) => {
                  console.warn("Failed to fetch billing records:", err);
                  return [];
                })
            : Promise.resolve([]),
          expertService.getExpertsByClinic(clinicId).catch((err) => {
            console.warn("Failed to fetch experts:", err);
            return [];
          }),
        ]);

      // Extract data from results with proper fallbacks
      const clinicData =
        results[0].status === "fulfilled" ? results[0].value : null;
      const layoutConfig =
        results[1].status === "fulfilled" ? results[1].value : null;
      const doctors = results[2].status === "fulfilled" ? results[2].value : [];
      const appointments =
        results[3].status === "fulfilled" ? results[3].value : [];
      const prescriptions =
        results[4].status === "fulfilled" ? results[4].value : [];
      const documents =
        results[5].status === "fulfilled" ? results[5].value : [];
      const xrays = results[6].status === "fulfilled" ? results[6].value : [];
      const noteEntries =
        results[7].status === "fulfilled" ? results[7].value : [];
      const medicalReportResponses =
        results[8].status === "fulfilled" ? results[8].value : null;
      const rawMedicalReportFields =
        results[9].status === "fulfilled" ? results[9].value : [];
        
      // Deduplicate medical report fields to prevent duplicate print rows
      const medicalReportFields = [];
      const seenKeys = new Set<string>();
      for (const field of rawMedicalReportFields as any[]) {
        if (!seenKeys.has(field.fieldKey)) {
          seenKeys.add(field.fieldKey);
          medicalReportFields.push(field);
        }
      }

      const billingRecords =
        results[10].status === "fulfilled" ? results[10].value : [];
      const experts =
        results[11].status === "fulfilled" ? results[11].value : [];

      // Generate and open print window
      const printContent = generateComprehensivePrintContent({
        patient,
        clinic: clinicData,
        layoutConfig,
        doctors,
        experts,
        appointments,
        prescriptions,
        documents,
        xrays,
        noteEntries,
        medicalReportResponses,
        medicalReportFields,
        billingRecords,
        isBillingEnabled,
      });

      const printWindow = window.open("", "_blank", "width=1200,height=800");

      if (printWindow) {
        printWindow.document.write(printContent);
        printWindow.document.close();

        addToast({
          title: "Report Generated",
          description: "Comprehensive patient report generated successfully",
          color: "success",
        });
      } else {
        throw new Error("Unable to open print window");
      }
    } catch (error) {
      console.error("Error generating comprehensive print:", error);
      addToast({
        title: "Error",
        description:
          "Failed to generate comprehensive patient report. Please try again.",
        color: "danger",
      });
    } finally {
      setIsGeneratingPrint(false);
    }
  };

  const generateComprehensivePrintContent = (data: any) => {
    const {
      patient,
      clinic,
      layoutConfig,
      doctors = [],
      experts = [],
      prescriptions = [],
      noteEntries = [],
      medicalReportResponses = null,
      medicalReportFields = [],
      billingRecords = [],
      isBillingEnabled,
    } = data;

    const brandingCSS = layoutConfig ? getPrintBrandingCSS(layoutConfig) : "";
    const headerHtml =
      clinic && layoutConfig ? getPrintHeaderHTML(layoutConfig, clinic) : "";
    const footerHtml = layoutConfig ? getPrintFooterHTML(layoutConfig) : "";

    const headerHeight =
      layoutConfig?.headerHeight === "compact"
        ? 140
        : layoutConfig?.headerHeight === "expanded"
          ? 220
          : 180;
          
    const topMarginMm = layoutConfig?.contentTopMarginWithoutLetterheadMm || 10;

    const primaryDoctor = doctors.find((d: any) => d.id === patient.doctorId);
    const doctorName = primaryDoctor ? primaryDoctor.name : "—";
    
    const primaryExpert = experts.find((e: any) => e.id === patient.assignedExpertId);
    const expertName = primaryExpert ? primaryExpert.name : null;
    const consultantText = expertName && expertName !== "—" 
      ? `${doctorName} / ${expertName}` 
      : doctorName;

    const patientAge = calculateAge(patient.dob) || patient.age || "—";
    const patientBg = patient.bloodGroup || (medicalReportResponses?.fieldValues && medicalReportResponses.fieldValues["blood-group"]) || "—";
    const regDate = patient.createdAt ? new Date(patient.createdAt).toLocaleDateString() : "—";
    const displayAddress = patient.address && patient.address.toLowerCase() !== "walk-in" ? patient.address : "—";

    return `<!DOCTYPE html>
<html>
<head>
  <title>Patient Report - ${patient.name}</title>
  <style>
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: white; -webkit-print-color-adjust: exact; width: 100%; }
    body { 
      ${brandingCSS}
      font-family: 'Inter', -apple-system, sans-serif;
    }
    
    .header-fixed { position: fixed; top: 0; width: 100%; z-index: 1000; background: white; }
    .footer-fixed { position: fixed; bottom: 0; width: 100%; z-index: 1000; background: white; }
    .header-spacer { height: ${headerHtml ? `${headerHeight}px` : `${topMarginMm}mm`}; }
    .footer-spacer { height: ${footerHtml ? 60 : 20}px; }

    .print-container { 
      width: 100%;
      padding: 0 6mm;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
    }
    
    .content { flex: 1; padding: 0; }
    
    .document-title { 
      text-align: center; 
      margin: 10px 0 15px; 
      border-top: 1px solid #e2e8f0; 
      border-bottom: 1px solid #e2e8f0; 
      padding: 6px 0; 
      background-color: #f8fafc;
    }
    .document-title h2 { 
      font-size: 15px; 
      font-weight: 600; 
      margin: 0; 
      text-transform: uppercase; 
      letter-spacing: 0.1em; 
      color: #0f172a; 
    }
    .document-subtitle { font-size: 10px; color: #64748b; margin-top: 2px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; }
    
    .patient-id-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      border: 1px solid #cbd5e1;
    }
    .patient-id-table th, .patient-id-table td {
      border: 1px solid #cbd5e1;
      padding: 6px 8px;
      font-size: 10px;
    }
    .patient-id-table th {
      background-color: #f1f5f9;
      color: #475569;
      font-weight: 600;
      text-transform: uppercase;
      text-align: left;
      width: 15%;
      letter-spacing: 0.02em;
    }
    .patient-id-table td {
      color: #0f172a;
      font-weight: 500;
      width: 35%;
    }

    .section { margin-bottom: 15px; page-break-inside: avoid; }
    .section-header { 
      margin-bottom: 8px; 
      font-size: 10px; 
      font-weight: 600; 
      color: #64748b; 
      text-transform: uppercase; 
      letter-spacing: 0.05em;
      border-left: 3px solid var(--primary-color, #0d9488);
      padding-left: 8px;
    }

    .report-table { width: 100%; border-collapse: collapse; page-break-inside: avoid; }
    .report-table th { 
      background: #f8fafc; 
      color: #64748b; 
      font-size: 9.5px; 
      font-weight: 600; 
      text-transform: uppercase; 
      padding: 6px 10px; 
      border: 1px solid #e2e8f0; 
      text-align: left; 
    }
    .report-table td { padding: 6px 10px; border: 1px solid #e2e8f0; font-size: 10.5px; color: #334155; vertical-align: top; }
    
    .financial-summary-table { width: 100%; border-collapse: collapse; page-break-inside: avoid; }
    .financial-summary-table th { 
      background: #f8fafc; 
      color: #64748b; 
      font-size: 9.5px; 
      font-weight: 600; 
      text-transform: uppercase; 
      padding: 6px 10px; 
      border: 1px solid #e2e8f0; 
      text-align: left; 
    }
    .financial-summary-table td { padding: 6px 10px; border: 1px solid #e2e8f0; font-size: 10.5px; }

    .empty-state { text-align: center; color: #94a3b8; font-style: italic; padding: 15px; font-size: 10px; }

    @media print { 
      body { padding: 0; margin: 0; } 
      .section, .report-table, .financial-summary-table { page-break-inside: avoid; } 
    }
  </style>
</head>
<body>
  ${headerHtml ? `<div class="header-fixed">${headerHtml}</div>` : ""}
  
  <div class="print-container">
    <div class="header-spacer"></div>
    
    <div class="content">
      <div class="document-title">
        <h2>Comprehensive Health Record</h2>
        <div class="document-subtitle">Clinical Summary for ${patient.name}</div>
      </div>
      
      <table class="patient-id-table">
        <tbody>
          <tr>
            <th>Patient Name</th>
            <td style="font-size: 11.5px; font-weight: 700;">${patient.name}</td>
            <th>Reg / UHID #</th>
            <td style="font-weight: 600;">${patient.regNumber || "—"}</td>
          </tr>
          <tr>
            <th>Age / Gender</th>
            <td>${patientAge} / <span style="text-transform: capitalize;">${patient.gender || "—"}</span></td>
            <th>Blood Group</th>
            <td><strong style="color: #be123c;">${patientBg}</strong></td>
          </tr>
          <tr>
            <th>Address</th>
            <td>${displayAddress}</td>
            <th>Contact</th>
            <td>${patient.mobile || "—"}</td>
          </tr>
          <tr>
            <th>Consultant</th>
            <td style="font-weight: 600;">${consultantText}</td>
            <th>Registered On</th>
            <td>${regDate}</td>
          </tr>
        </tbody>
      </table>

      ${
        medicalReportResponses && medicalReportFields.length > 0
          ? `
        <div class="section">
          <div class="section-header">Clinical History & Results</div>
          <table class="report-table">
            <thead>
              <tr>
                <th style="width: 40%">Parameter</th>
                <th>Result / Finding</th>
              </tr>
            </thead>
            <tbody>
              ${medicalReportFields
                .map((field: any) => {
                  const response =
                    medicalReportResponses.fieldValues?.[field.fieldKey];

                  if (!response || response === "") return "";

                  return `
                    <tr>
                      <td style="font-weight: 500; color: #475569;">${field.fieldLabel}</td>
                      <td>${Array.isArray(response) ? response.join(", ") : response}</td>
                    </tr>
                  `;
                })
                .join("")}
            </tbody>
          </table>
        </div>`
          : ""
      }

      ${
        prescriptions.length > 0
          ? `
        <div class="section">
          <div class="section-header">Medication Treatment Plans</div>
          <table class="report-table">
            <thead>
              <tr>
                <th>Medicine Name</th>
                <th>Dosage / Frequency</th>
                <th style="width: 100px">Duration</th>
                <th style="width: 100px">Date</th>
              </tr>
            </thead>
            <tbody>
              ${prescriptions
                .map(
                  (p: any) =>
                    p.items
                      ?.map(
                        (item: any) => `
                  <tr>
                    <td style="font-weight: 500; color: #1e293b;">${item.medicineName}</td>
                    <td>${item.dosage || "-"} • ${item.frequency || "-"}</td>
                    <td>${item.duration || "-"}</td>
                    <td style="font-size: 10px; color: #64748b;">${p.prescriptionDate ? new Date(p.prescriptionDate).toLocaleDateString() : "-"}</td>
                  </tr>
                `,
                      )
                      .join("") || "",
                )
                .join("")}
            </tbody>
          </table>
        </div>`
          : ""
      }

      ${
        noteEntries.length > 0
          ? `
        <div class="section">
          <div class="section-header">Clinical Progress Notes</div>
          <table class="report-table">
            <thead>
              <tr>
                <th style="width: 30%">Category</th>
                <th>Clinical Note</th>
              </tr>
            </thead>
            <tbody>
              ${noteEntries
                .map(
                  (note: any) => `
                  <tr>
                    <td style="font-weight: 500; color: #475569;">${note.sectionLabel || "General"}</td>
                    <td>${note.content}</td>
                  </tr>
                `,
                )
                .join("")}
            </tbody>
          </table>
        </div>`
          : ""
      }

      ${
        isBillingEnabled && billingRecords.length > 0
          ? `
      <div class="section">
        <div class="section-header">Financial Summary</div>
        <table class="financial-summary-table">
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Date</th>
              <th style="text-align: right">Total Amount</th>
              <th style="text-align: center">Status</th>
            </tr>
          </thead>
          <tbody>
            ${billingRecords
              .map(
                (b: any) => `
                <tr>
                  <td style="font-weight: 500; color: #1e293b;">${b.invoiceNumber || b.billNumber || "DRAFT"}</td>
                  <td>${b.invoiceDate ? new Date(b.invoiceDate).toLocaleDateString() : "-"}</td>
                  <td style="text-align: right; font-weight: 600; color: #0f172a;">NPR ${b.totalAmount?.toLocaleString() || "0"}</td>
                  <td style="text-align: center;"><span style="font-size: 9px; font-weight: 600; padding: 2px 6px; border-radius: 4px; border: 1px solid #e2e8f0; text-transform: uppercase;">${b.status || "Pending"}</span></td>
                </tr>
              `,
              )
              .join("")}
          </tbody>
        </table>
      </div>`
          : ""
      }
    </div>
    
    <div class="footer-spacer"></div>
  </div>

  ${footerHtml ? `<div class="footer-fixed">${footerHtml}</div>` : ""}
  
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
        window.onafterprint = function() { window.close(); };
      }, 500);
    };
  </script>
</body>
</html>`;
  };

  if (loading || authLoading) {
    return (
      <div className="flex justify-center items-center py-16">
        <Spinner label="Loading patient…" size="lg" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="py-16 text-center">
        <IoWarningOutline className="mx-auto text-mountain-300 w-12 h-12 mb-3" />
        <p className="text-[13px] text-mountain-500 mb-4">Patient not found.</p>
        <Link className="no-underline" to="/dashboard/patients">
          <Button color="primary" size="sm">
            Back to Patients
          </Button>
        </Link>
      </div>
    );
  }

  // ── Tab definitions ─────────────────────────────────────────────────────────
  const TABS = [
    {
      key: "overview",
      icon: <IoInformationCircleOutline className="w-4 h-4" />,
      label: "Overview",
    },
    {
      key: "medical-records",
      icon: <IoDocumentTextOutline className="w-4 h-4" />,
      label: "Medical Records",
    },
    {
      key: "medical-report",
      icon: <IoMedicalOutline className="w-4 h-4" />,
      label: "Medical Report",
    },
    {
      key: "appointments",
      icon: <IoCalendarOutline className="w-4 h-4" />,
      label: "Appointments",
    },
    {
      key: "notes",
      icon: <IoDocumentTextOutline className="w-4 h-4" />,
      label: "Notes",
    },
    {
      key: "prescriptions",
      icon: <IoReceiptOutline className="w-4 h-4" />,
      label: "Prescriptions",
    },
    ...(isBillingEnabled
      ? [
          {
            key: "billing",
            icon: <IoReceiptOutline className="w-4 h-4" />,
            label: "Billing",
          },
          {
            key: "wallet",
            icon: <IoWalletOutline className="w-4 h-4" />,
            label: "Wallet & Deposits",
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* ── Page header ────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <button
            aria-label="Back"
            className="p-1.5 rounded border border-border-base text-text-muted hover:text-primary hover:border-primary transition-colors"
            type="button"
            onClick={() => navigate(-1)}
          >
            <IoArrowBackOutline className="w-4 h-4" />
          </button>
          <div>
            <h1
              className={`${title({ size: "lg" })} text-primary leading-tight`}
            >
              Patient Profile
              {patient?.isCritical && (
                <span className="ml-2 text-[11px] font-semibold bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/20 px-1.5 py-0.5 rounded align-middle">
                  ⚠ CRITICAL
                </span>
              )}
            </h1>
            <p className="text-[13.5px] text-text-muted mt-1">
              View and manage patient information
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            color="default"
            isLoading={isGeneratingPrint}
            size="sm"
            startContent={<IoPrintOutline className="w-3.5 h-3.5" />}
            variant="bordered"
            onClick={handlePrintAll}
          >
            {isGeneratingPrint ? "Generating…" : "Print All"}
          </Button>
          <Link
            className="no-underline"
            to={`/dashboard/patients/${patientId}/edit`}
          >
            <Button
              color="primary"
              size="sm"
              startContent={<IoCreateOutline className="w-3.5 h-3.5" />}
              variant="bordered"
            >
              Edit
            </Button>
          </Link>
          <Link
            className="no-underline"
            to={`/dashboard/appointments/new?patientId=${patientId}`}
          >
            <Button
              color="primary"
              size="sm"
              startContent={<IoCalendarOutline className="w-3.5 h-3.5" />}
            >
              New Appointment
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Tabbed content shell ────────────────────────────────────────── */}
      <div className="bg-surface border border-border-base rounded-2xl overflow-visible shadow-sm">
        {/* Custom tab strip — matches spec: underline style, teal active */}
        <div className="flex overflow-x-auto border-b border-border-base scrollbar-none">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              className={`
                  inline-flex items-center gap-1.5 px-4 py-3 text-[12.5px] font-medium whitespace-nowrap
                  border-b-2 transition-colors shrink-0
                  ${
                    selectedTab === tab.key
                      ? "border-primary text-primary bg-primary/5"
                      : "border-transparent text-text-muted hover:text-text-main hover:bg-surface-2"
                  }
                `}
              type="button"
              onClick={() => handleTabChange(tab.key)}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="p-4">
          {selectedTab === "overview" && (
            <>
              <PatientOverviewTab patient={patient} />
              <Divider className="my-5" />
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Left: Medical Reports */}
                <div className="flex flex-col gap-3">
                  <PatientMedicalReportTab
                    clinicId={clinicId!}
                    compactLayout={true}
                    patientId={patientId!}
                  />
                </div>
                {/* Middle: Appointments + Prescriptions */}
                <div className="flex flex-col gap-5 lg:col-span-2">
                  <div>
                    <PatientAppointmentsTab patientId={patientId!} />
                  </div>
                  <div>
                    <PatientPrescriptionsTab patientId={patientId!} />
                  </div>
                </div>
              </div>
            </>
          )}

          {selectedTab === "medical-records" && (
            <PatientMedicalRecordsTab patientId={patientId!} />
          )}

          {selectedTab === "medical-report" && (
            <PatientMedicalReportTab
              clinicId={clinicId!}
              patientId={patientId!}
            />
          )}

          {selectedTab === "appointments" && (
            <PatientAppointmentsTab patientId={patientId!} />
          )}

          {selectedTab === "notes" && (
            <PatientNotesTab clinicId={clinicId!} patientId={patientId!} />
          )}

          {selectedTab === "prescriptions" && (
            <PatientPrescriptionsTab patientId={patientId!} />
          )}

          {selectedTab === "billing" && isBillingEnabled && (
            <PatientBillingTab patientId={patientId!} />
          )}

          {selectedTab === "wallet" && isBillingEnabled && (
            <PatientWalletTab patient={patient} />
          )}
        </div>
      </div>
    </div>
  );
}
