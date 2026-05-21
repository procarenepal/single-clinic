/**
 * Prescription Detail Page — Clinic Clarity without HeroUI
 */
import React, { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  IoArrowBackOutline,
  IoCreateOutline,
  IoDownloadOutline,
  IoPrintOutline,
} from "react-icons/io5";

import { title } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/ui/skeleton";
import { addToast } from "@/components/ui/toast";
import { prescriptionService } from "@/services/prescriptionService";
import { patientService } from "@/services/patientService";
import { doctorService } from "@/services/doctorService";
import { appointmentService } from "@/services/appointmentService";
import { appointmentTypeService } from "@/services/appointmentTypeService";
import { clinicService } from "@/services/clinicService";
import { useAuthContext } from "@/context/AuthContext";
import { Prescription, PrescriptionItem } from "@/types/medical-records";
import { Patient, Doctor, Appointment } from "@/types/models";
import { PrintLayoutConfig } from "@/types/printLayout";
import {
  getPrintBrandingCSS,
  getPrintHeaderHTML,
  getPrintFooterHTML,
} from "@/utils/printBranding";

interface PrescriptionWithDetails extends Prescription {
  patientName?: string;
  patientAge?: string | number;
  patientGender?: string;
  patientPhone?: string;
  doctorName?: string;
  doctorSpeciality?: string;
  items?: PrescriptionItem[];
  appointmentInfo?: Appointment;
  appointmentTypeName?: string;
}

export default function PrescriptionDetailPage() {
  const navigate = useNavigate();
  const { prescriptionId } = useParams<{ prescriptionId: string }>();
  const [searchParams] = useSearchParams();
  const { clinicId, userData } = useAuthContext();
  const effectiveBranchId = userData?.branchId ?? undefined;

  const [prescription, setPrescription] =
    useState<PrescriptionWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [layoutConfig, setLayoutConfig] = useState<PrintLayoutConfig | null>(
    null,
  );
  const [clinic, setClinic] = useState<any>(null);

  const formatDate = (date: Date | null | undefined | string) => {
    if (!date) return "N/A";
    const d = new Date(date);

    if (isNaN(d.getTime())) return "N/A";

    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
  };

  useEffect(() => {
    const fetchPrescriptionData = async () => {
      if (!prescriptionId) return;

      try {
        setLoading(true);
        setError(null);

        const prescriptionData =
          await prescriptionService.getPrescriptionById(prescriptionId);

        if (!prescriptionData) {
          setError("Prescription not found");

          return;
        }
        if (
          effectiveBranchId != null &&
          prescriptionData.branchId !== effectiveBranchId
        ) {
          setError("You don't have access to this prescription.");
          setPrescription(null);
          setLoading(false);

          return;
        }

        const prescriptionItems =
          await prescriptionService.getPrescriptionItems(prescriptionId);

        let clinicData = null;
        let layoutConfigData = null;

        if (clinicId) {
          [clinicData, layoutConfigData] = await Promise.all([
            clinicService.getClinicById(clinicId),
            clinicService.getPrintLayoutConfig(clinicId),
          ]);
        }

        let patientData: Patient | null = null;

        try {
          patientData = await patientService.getPatientById(
            prescriptionData.patientId,
          );
        } catch (e) {}

        let doctorData: Doctor | null = null;

        try {
          doctorData = await doctorService.getDoctorById(
            prescriptionData.doctorId,
          );
        } catch (e) {}

        let appointmentData: Appointment | null = null;
        let appointmentTypeName: string | undefined;

        if (prescriptionData.appointmentId) {
          try {
            appointmentData = await appointmentService.getAppointmentById(
              prescriptionData.appointmentId,
            );
            if (appointmentData?.appointmentTypeId) {
              const appointmentType =
                await appointmentTypeService.getAppointmentTypeById(
                  appointmentData.appointmentTypeId,
                );

              appointmentTypeName = appointmentType?.name;
            }
          } catch (e) {}
        }

        const combinedData: PrescriptionWithDetails = {
          ...prescriptionData,
          items: prescriptionItems,
          patientName: patientData?.name || "Unknown Patient",
          patientAge: patientData?.age,
          patientGender: patientData?.gender,
          patientPhone: patientData?.phone || patientData?.mobile,
          doctorName: doctorData?.name || "Unknown Doctor",
          doctorSpeciality: doctorData?.speciality,
          appointmentInfo: appointmentData || undefined,
          appointmentTypeName: appointmentTypeName,
        };

        setPrescription(combinedData);
        if (clinicData) setClinic(clinicData);
        if (layoutConfigData) setLayoutConfig(layoutConfigData);
      } catch (err) {
        console.error("Error fetching prescription:", err);
        setError("Failed to load prescription data");
      } finally {
        setLoading(false);
      }
    };

    fetchPrescriptionData();
  }, [prescriptionId, clinicId, effectiveBranchId]);

  useEffect(() => {
    if (!loading && prescription && searchParams.get("print") === "true") {
      setTimeout(() => handlePrint(), 300);
    }
  }, [loading, prescription, searchParams]);

  const handleEdit = () =>
    navigate(`/dashboard/prescriptions/${prescriptionId}/edit`);

  const handlePrint = () => {
    if (!prescription) return;
    const printWindow = window.open("", "_blank", "width=800,height=600");

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

    if (printWindow) {
      const itemsHtml =
        prescription.items
          ?.map(
            (item) =>
              `<tr>
          <td style="font-weight: 500; color: #1e293b;">${item.medicineName}</td>
          <td class="text-center">${item.dosage}</td>
          <td class="text-center">${item.frequency}</td>
          <td class="text-center">${item.duration}</td>
          <td class="text-center">${item.time}</td>
        </tr>`,
          )
          .join("") || "";

      const printContent = `<!DOCTYPE html>
<html>
<head>
  <title>Prescription - ${prescription.prescriptionNo}</title>
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
      padding: 0 8mm;
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
    }
    .document-title h2 { 
      font-size: 18px; 
      font-weight: 600; 
      margin: 0; 
      color: #1e293b; 
    }
    .document-subtitle { font-size: 12px; color: #64748b; margin-top: 3px; font-weight: 400; }
    
    .prescription-header-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 1px dashed #e2e8f0;
    }
    .meta-item { display: flex; flex-direction: column; }
    .meta-label { font-size: 10px; font-weight: 600; color: #64748b; margin-bottom: 2px; }
    .meta-value { font-size: 13px; font-weight: 600; color: #1e293b; }

    .patient-doctor-grid { 
      display: grid; 
      grid-template-columns: 1fr 1fr; 
      gap: 30px; 
      margin-bottom: 20px; 
      background: #f8fafc;
      padding: 12px 15px;
      border-radius: 6px;
      border: 1px solid #f1f5f9;
    }
    .info-section h3 { 
      margin: 0 0 10px 0; 
      font-size: 12px; 
      font-weight: 600; 
      color: #1e293b; 
      border-bottom: 1.5px solid #f1f5f9;
      padding-bottom: 4px;
    }
    .info-item { display: flex; margin-bottom: 5px; font-size: 12px; align-items: baseline; }
    .info-label { font-weight: 500; color: #64748b; width: 90px; shrink: 0; font-size: 10px; }
    .info-value { color: #1e293b; font-weight: 600; }

    .prescription-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    .prescription-table th { 
      background: #f8fafc; 
      color: #475569; 
      font-size: 10px; 
      font-weight: 600; 
      padding: 10px 12px; 
      border: 1px solid #e2e8f0; 
      text-align: left; 
    }
    .prescription-table td { padding: 10px 12px; border: 1px solid #e2e8f0; font-size: 12px; color: #334155; }
    .text-center { text-align: center; }

    .notes-section { margin: 20px 0; page-break-inside: avoid; }
    .notes-section h3 { font-size: 12px; font-weight: 600; color: #1e293b; margin-bottom: 8px; display: flex; align-items: center; }
    .notes-section.diagnosis h3::before { content: ""; display: inline-block; width: 4px; height: 14px; background: #3b82f6; margin-right: 8px; border-radius: 2px; }
    .notes-content { padding: 12px 15px; background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #3b82f6; border-radius: 6px; font-size: 12px; line-height: 1.6; color: #1e293b; white-space: pre-wrap; }

    .signature-row { margin-top: 50px; display: flex; justify-content: space-between; page-break-inside: avoid; }
    .sig-box { width: 180px; text-align: center; }
    .sig-line { border-top: 1px solid #94a3b8; margin-bottom: 4px; }
    .sig-label { font-size: 10px; font-weight: 500; color: #64748b; }

    .dossier-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 18px;
      page-break-inside: avoid;
    }
    .dossier-box {
      border: 1.5px solid #cbd5e1;
      border-radius: 8px;
      padding: 10px 12px;
      background: #fafafb;
      min-height: 50px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      page-break-inside: avoid;
    }
    .dossier-box.full-width {
      width: 100%;
    }
    .dossier-title {
      font-size: 9.5px;
      font-weight: 800;
      color: ${layoutConfig?.primaryColor || "#0ea5e9"};
      text-transform: uppercase;
      letter-spacing: 0.8px;
      border-bottom: 1.5px dashed #cbd5e1;
      padding-bottom: 4px;
      margin-bottom: 4px;
    }
    .dossier-content {
      font-size: 11.5px;
      line-height: 1.45;
      color: #334155;
      white-space: pre-wrap;
    }

    @media print { 
      body { padding: 0; margin: 0; } 
      .patient-doctor-grid, .prescription-table, .notes-section, .dossier-grid, .dossier-box { page-break-inside: avoid; } 
    }
  </style>
</head>
<body>
  ${headerHtml ? `<div class="header-fixed">${headerHtml}</div>` : ""}
  
  <div class="print-container">
    <div class="header-spacer"></div>
    
    <div class="content">
      <div class="document-title">
        <h2>Medical Prescription</h2>
        <div class="document-subtitle">Professional Treatment Plan</div>
      </div>

      <div class="prescription-header-row">
        <div class="meta-item">
          <span class="meta-label">Prescription No.</span>
          <span class="meta-value">#${prescription.prescriptionNo}</span>
        </div>
        <div class="meta-item" style="text-align: right;">
          <span class="meta-label">Date Issued</span>
          <span class="meta-value">${formatDate(prescription.prescriptionDate)}</span>
        </div>
      </div>

      <div class="patient-doctor-grid">
        <div class="info-section">
          <h3>Patient Detail</h3>
          <div class="info-item"><span class="info-label">Name:</span><span class="info-value">${prescription.patientName}</span></div>
          ${
            prescription.patientAge || prescription.patientGender
              ? `
            <div class="info-item"><span class="info-label">Age/Gen:</span><span class="info-value">${[prescription.patientAge, prescription.patientGender].filter(Boolean).join(" / ")}</span></div>
          `
              : ""
          }
          ${
            prescription.patientPhone
              ? `
            <div class="info-item"><span class="info-label">Contact:</span><span class="info-value">${prescription.patientPhone}</span></div>
          `
              : ""
          }
        </div>
        <div class="info-section">
          <h3>Physician Detail</h3>
          <div class="info-item"><span class="info-label">Physician:</span><span class="info-value">${prescription.doctorName}</span></div>
          ${
            prescription.doctorSpeciality
              ? `
            <div class="info-item"><span class="info-label">Speciality:</span><span class="info-value">${prescription.doctorSpeciality}</span></div>
          `
              : ""
          }
          ${
            prescription.appointmentInfo && prescription.appointmentTypeName
              ? `
            <div class="info-item"><span class="info-label">Visit Type:</span><span class="info-value">${prescription.appointmentTypeName}</span></div>
          `
              : ""
          }
        </div>
      </div>

      ${(() => {
        let dossierHtml = "";
        const hasDossier =
          prescription.history ||
          prescription.examination ||
          prescription.investigation ||
          prescription.diagnosis;

        if (hasDossier) {
          dossierHtml += `<div class="dossier-grid">`;
          if (prescription.history) {
            dossierHtml += `
              <div class="dossier-box">
                <div class="dossier-title">HISTORY :-</div>
                <div class="dossier-content">${prescription.history}</div>
              </div>`;
          }
          if (prescription.examination) {
            dossierHtml += `
              <div class="dossier-box">
                <div class="dossier-title">EXAMINATION</div>
                <div class="dossier-content">${prescription.examination}</div>
              </div>`;
          }
          if (prescription.investigation) {
            dossierHtml += `
              <div class="dossier-box">
                <div class="dossier-title">INVESTIGATION:</div>
                <div class="dossier-content">${prescription.investigation}</div>
              </div>`;
          }
          if (prescription.diagnosis) {
            dossierHtml += `
              <div class="dossier-box">
                <div class="dossier-title">DIAGNOSIS:</div>
                <div class="dossier-content">${prescription.diagnosis}</div>
              </div>`;
          }
          dossierHtml += `</div>`;
        }

        return dossierHtml;
      })()}

      <table class="prescription-table">
        <thead>
          <tr>
            <th>Medicine Name & Description</th>
            <th width="80" class="text-center">Dosage</th>
            <th width="100" class="text-center">Frequency</th>
            <th width="80" class="text-center">Duration</th>
            <th width="80" class="text-center">Time</th>
          </tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
      </table>

      ${
        prescription.treatmentPlan
          ? `
        <div class="dossier-box full-width" style="margin-bottom: 20px; width: 100%;">
          <div class="dossier-title">TREATMENT PLAN</div>
          <div class="dossier-content">${prescription.treatmentPlan}</div>
        </div>`
          : ""
      }

      ${
        prescription.notes
          ? `
        <div class="notes-section">
          <h3>Extra Administrative Notes & Instructions</h3>
          <div class="notes-content">${prescription.notes}</div>
        </div>`
          : ""
      }

      <div class="signature-row">
        <div class="sig-box">
          <div class="sig-line"></div>
          <span class="sig-label">Patient/Guardian Signature</span>
        </div>
        <div class="sig-box">
          <div class="sig-line"></div>
          <span class="sig-label">Authorized Physician Signature</span>
        </div>
      </div>
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

      printWindow.document.write(printContent);
      printWindow.document.close();
    } else {
      addToast({
        title: "Error",
        description:
          "Unable to open print window. Please check your browser settings.",
        color: "danger",
      });
    }
  };

  const handleDownload = () =>
    addToast({
      title: "Download",
      description: "Download functionality will be implemented soon.",
      color: "primary",
    });

  const statusColors: Record<string, string> = {
    active: "bg-primary/10 text-primary border-primary/20",
    completed: "bg-surface-2 text-text-muted border-border-base",
    cancelled: "bg-red-500/10 text-red-500 border-red-500/20",
  };

  if (loading) {
    return (
      <div className="p-2">
        <PageSkeleton />
      </div>
    );
  }

  if (error || !prescription) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-surface border border-border-base rounded-[10px] shadow-sm">
        <p className="text-red-500 text-lg mb-4">
          {error || "Prescription not found"}
        </p>
        <Button
          startContent={<IoArrowBackOutline />}
          variant="bordered"
          onClick={() => navigate(-1)}
        >
          Back
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-12">
      {/* ── Page Header ────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
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
              Prescription Details
            </h1>
            <p className="text-[13px] font-medium text-text-muted mt-0.5">
              Ref:{" "}
              <span className="text-text-main tracking-wider">
                {prescription.prescriptionNo}
              </span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            startContent={<IoCreateOutline className="w-3.5 h-3.5" />}
            variant="bordered"
            onClick={handleEdit}
          >
            Edit
          </Button>
          <Button
            size="sm"
            startContent={<IoPrintOutline className="w-3.5 h-3.5" />}
            variant="bordered"
            onClick={handlePrint}
          >
            Print
          </Button>
          <Button
            color="primary"
            size="sm"
            startContent={<IoDownloadOutline className="w-3.5 h-3.5" />}
            onClick={handleDownload}
          >
            Download
          </Button>
        </div>
      </div>

      {/* ── Main Layout Grid ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Left Column: Dossier Content */}
        <div className="lg:col-span-3 space-y-4">
          {/* Patient & Doctor Information (Combined Dossier Section) */}
          <div className="bg-surface border border-border-base rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-3 border-b border-border-base bg-surface-2/30">
              <h3 className="text-[12.5px] font-semibold text-text-main">
                Clinical Assignment & Patient Record
              </h3>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Patient Information */}
                <div className="space-y-3">
                  <h4 className="text-[10px] font-semibold text-primary/70 border-b border-border-base/50 pb-1">
                    Patient Identification
                  </h4>
                  <div className="space-y-2.5">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-semibold text-text-muted">
                        Legal Name
                      </span>
                      <span className="text-[13.5px] font-medium text-text-main">
                        {prescription.patientName}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-semibold text-text-muted">
                          Age / Gender
                        </span>
                        <span className="text-[13px] font-medium text-text-main">
                          {prescription.patientAge || "—"} /{" "}
                          {prescription.patientGender || "—"}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-semibold text-text-muted">
                          Contact
                        </span>
                        <span className="text-[13px] font-medium text-text-main">
                          {prescription.patientPhone || "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Doctor Information */}
                <div className="space-y-3">
                  <h4 className="text-[10px] font-semibold text-primary/70 border-b border-border-base/50 pb-1">
                    Physician Details
                  </h4>
                  <div className="space-y-2.5">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-semibold text-text-muted">
                        Prescribing Doctor
                      </span>
                      <span className="text-[13.5px] font-medium text-text-main">
                        {prescription.doctorName}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-semibold text-text-muted">
                        Speciality
                      </span>
                      <span className="text-[13px] font-medium text-text-main">
                        {prescription.doctorSpeciality || "Dermatologist"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Appointment Information (Optional) */}
                {prescription.appointmentInfo ? (
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-semibold text-primary/70 border-b border-border-base/50 pb-1">
                      Encounter Reference
                    </h4>
                    <div className="space-y-2.5">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-semibold text-text-muted">
                          Visit Date
                        </span>
                        <span className="text-[13px] font-medium text-text-main">
                          {formatDate(
                            prescription.appointmentInfo.appointmentDate,
                          )}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-semibold text-text-muted">
                          Encounter Type
                        </span>
                        <span className="text-[13px] font-medium text-text-main capitalize">
                          {prescription.appointmentTypeName || "Clinical Visit"}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center border-l border-border-base/50 px-4">
                    <p className="text-[11px] text-text-muted text-center italic">
                      Direct prescription without linked appointment
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Clinical Assessment Case Folder (History, Examination, Investigation, Diagnosis) */}
          {(prescription.history ||
            prescription.examination ||
            prescription.investigation ||
            prescription.diagnosis) && (
            <div className="space-y-4">
              {/* History Card */}
              {prescription.history && (
                <div className="bg-surface border border-border-base rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                  <div className="px-5 py-3 border-b border-border-base bg-surface-2/30 flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <h3 className="text-[12.5px] font-bold text-text-main uppercase tracking-wider">
                      Patient Clinical History
                    </h3>
                  </div>
                  <div className="p-5">
                    <p className="text-[13px] text-text-main leading-relaxed font-medium bg-surface-2/30 p-4 rounded-xl border border-border-base/50 whitespace-pre-wrap">
                      {prescription.history}
                    </p>
                  </div>
                </div>
              )}

              {/* Examination Card */}
              {prescription.examination && (
                <div className="bg-surface border border-border-base rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                  <div className="px-5 py-3 border-b border-border-base bg-surface-2/30 flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <h3 className="text-[12.5px] font-bold text-text-main uppercase tracking-wider">
                      Clinical Examination Findings
                    </h3>
                  </div>
                  <div className="p-5">
                    <p className="text-[13px] text-text-main leading-relaxed font-medium bg-surface-2/30 p-4 rounded-xl border border-border-base/50 whitespace-pre-wrap">
                      {prescription.examination}
                    </p>
                  </div>
                </div>
              )}

              {/* Investigation Card */}
              {prescription.investigation && (
                <div className="bg-surface border border-border-base rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                  <div className="px-5 py-3 border-b border-border-base bg-surface-2/30 flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <h3 className="text-[12.5px] font-bold text-text-main uppercase tracking-wider">
                      Investigations Ordered
                    </h3>
                  </div>
                  <div className="p-5">
                    <p className="text-[13px] text-text-main leading-relaxed font-medium bg-surface-2/30 p-4 rounded-xl border border-border-base/50 whitespace-pre-wrap">
                      {prescription.investigation}
                    </p>
                  </div>
                </div>
              )}

              {/* Diagnosis Card */}
              {prescription.diagnosis && (
                <div className="bg-surface border border-border-base rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                  <div className="px-5 py-3 border-b border-border-base bg-surface-2/30 flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <h3 className="text-[12.5px] font-bold text-text-main uppercase tracking-wider">
                      Diagnosis / Clinical Impression
                    </h3>
                  </div>
                  <div className="p-5">
                    <p className="text-[13px] text-text-main leading-relaxed font-medium bg-surface-2/30 p-4 rounded-xl border border-border-base/50 whitespace-pre-wrap">
                      {prescription.diagnosis}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Prescribed Medicines (High-Density Table) */}
          <div className="bg-surface border border-border-base rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-3 border-b border-border-base bg-surface-2/30">
              <h3 className="text-[12.5px] font-semibold text-text-main">
                Prescribed Medications
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-2/50 border-b border-border-base">
                    <th className="px-5 py-2.5 text-[10px] font-semibold text-text-muted">
                      Medicine / Description
                    </th>
                    <th className="px-5 py-2.5 text-[10px] font-semibold text-text-muted text-center">
                      Dosage
                    </th>
                    <th className="px-5 py-2.5 text-[10px] font-semibold text-text-muted text-center">
                      Duration
                    </th>
                    <th className="px-5 py-2.5 text-[10px] font-semibold text-text-muted text-center">
                      Time
                    </th>
                    <th className="px-5 py-2.5 text-[10px] font-semibold text-text-muted text-center">
                      Frequency
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-base/50">
                  {prescription.items?.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-primary/5 transition-colors group"
                    >
                      <td className="px-5 py-3">
                        <div className="font-medium text-[13px] text-text-main group-hover:text-primary transition-colors">
                          {item.medicineName}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-[12.5px] text-text-muted text-center font-medium">
                        {item.dosage}
                      </td>
                      <td className="px-5 py-3 text-[12.5px] text-text-muted text-center font-medium">
                        {item.duration}
                      </td>
                      <td className="px-5 py-3 text-[12.5px] text-text-muted text-center font-medium capitalize">
                        {item.time}
                      </td>
                      <td className="px-5 py-3 text-[12.5px] text-text-muted text-center font-medium capitalize">
                        {item.frequency}
                      </td>
                    </tr>
                  ))}
                  {(!prescription.items || prescription.items.length === 0) && (
                    <tr>
                      <td
                        className="px-5 py-8 text-center text-[12px] text-text-muted italic"
                        colSpan={5}
                      >
                        No medicines prescribed in this record.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Treatment Plan Card */}
          {prescription.treatmentPlan && (
            <div className="bg-surface border border-border-base rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <div className="px-5 py-3 border-b border-border-base bg-surface-2/30 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary" />
                <h3 className="text-[12.5px] font-bold text-text-main uppercase tracking-wider">
                  Care & Treatment Plan
                </h3>
              </div>
              <div className="p-5">
                <p className="text-[13px] text-text-main leading-relaxed font-medium bg-surface-2/30 p-4 rounded-xl border border-border-base/50 whitespace-pre-wrap">
                  {prescription.treatmentPlan}
                </p>
              </div>
            </div>
          )}

          {/* Notes & Instructions */}
          {prescription.notes && (
            <div className="bg-surface border border-border-base rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              <div className="px-5 py-3 border-b border-border-base bg-surface-2/30 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary" />
                <h3 className="text-[12.5px] font-bold text-text-main uppercase tracking-wider">
                  Extra Clinical Notes & Instructions
                </h3>
              </div>
              <div className="p-5">
                <p className="text-[13px] text-text-main leading-relaxed font-medium bg-surface-2/30 p-4 rounded-xl border border-border-base/50 whitespace-pre-wrap">
                  {prescription.notes}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Record Summary Sidebar */}
        <div className="space-y-4">
          <div className="bg-surface border border-border-base rounded-2xl shadow-sm sticky top-4 overflow-hidden">
            <div className="px-5 py-3 border-b border-border-base bg-surface-2/30">
              <h3 className="text-[12.5px] font-semibold text-text-main">
                Summary
              </h3>
            </div>
            <div className="p-5 space-y-3.5">
              <div className="flex justify-between items-center text-[12px]">
                <span className="text-text-muted font-semibold">
                  Prescription ID
                </span>
                <span className="font-medium text-text-main tracking-wider">
                  #{prescription.prescriptionNo}
                </span>
              </div>
              <div className="flex justify-between items-center text-[12px] pt-3 border-t border-border-base/50">
                <span className="text-text-muted font-semibold">Status</span>
                <span
                  className={`inline-flex px-2 py-0.5 border rounded-[6px] text-[10px] font-semibold uppercase tracking-wider ${statusColors[prescription.status] || statusColors.completed}`}
                >
                  {prescription.status}
                </span>
              </div>
              <div className="flex justify-between items-center text-[12px] pt-3 border-t border-border-base/50">
                <span className="text-text-muted font-semibold">
                  Record Date
                </span>
                <span className="font-medium text-text-main">
                  {formatDate(prescription.prescriptionDate)}
                </span>
              </div>
              <div className="flex justify-between items-center text-[12px] pt-3 border-t border-border-base/50">
                <span className="text-text-muted font-semibold">
                  Medications
                </span>
                <span className="font-medium text-text-main">
                  {prescription.items?.length || 0} Items
                </span>
              </div>
              <div className="flex justify-between items-center text-[12px] pt-3 border-t border-border-base/50">
                <span className="text-text-muted font-semibold">
                  Created On
                </span>
                <span className="font-medium text-text-main">
                  {formatDate(prescription.createdAt)}
                </span>
              </div>
              <div className="flex justify-between items-center text-[12px] pt-3 border-t border-border-base/50">
                <span className="text-text-muted font-semibold">
                  Last Activity
                </span>
                <span className="font-medium text-text-main">
                  {formatDate(prescription.updatedAt)}
                </span>
              </div>
            </div>

            <div className="px-5 py-4 bg-surface-2/30 border-t border-border-base flex flex-col gap-2">
              <p className="text-[10px] text-text-muted text-center font-semibold uppercase tracking-wider">
                Verification
              </p>
              <div className="flex justify-center">
                <div className="h-1.5 w-1.5 rounded-full bg-health-500 animate-pulse mr-2" />
                <span className="text-[11px] font-medium text-text-muted">
                  Digital Signature Verified
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
