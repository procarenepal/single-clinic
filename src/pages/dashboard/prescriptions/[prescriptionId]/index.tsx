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
        } catch (e) { }

        let doctorData: Doctor | null = null;

        try {
          doctorData = await doctorService.getDoctorById(
            prescriptionData.doctorId,
          );
        } catch (e) { }

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
          } catch (e) { }
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

    // Global Branding Utility
    const brandingCSS = layoutConfig ? getPrintBrandingCSS(layoutConfig) : "";
    const headerHtml = layoutConfig
      ? getPrintHeaderHTML(layoutConfig, clinic)
      : "";
    const footerHtml = layoutConfig ? getPrintFooterHTML(layoutConfig) : "";

    if (printWindow) {
      const itemsHtml =
        prescription.items
          ?.map(
            (item) =>
              `<tr>
          <td class="text-left">${item.medicineName}</td>
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
    body { ${brandingCSS} }
    .print-container { max-width: 100%; margin: 0; background: white; display: flex; flex-direction: column; padding: 0; box-sizing: border-box; }
    
    ${brandingCSS}

    .content { flex: 1; padding: 15mm; min-height: 0; }
    
    .document-title { text-align: center; margin: 10px 0 25px 0; }
    .document-title h2 { font-size: 20px; font-weight: 800; margin: 0; text-transform: uppercase; letter-spacing: 0.1em; color: #475569; }
    .document-subtitle { font-size: 13px; color: #64748b; margin: 5px 0; font-weight: 500; }
    
    .prescription-meta { display: flex; justify-content: space-between; margin-bottom: 25px; padding: 15px; background: #f8fafc; border-radius: 8px; border: 1px solid #f1f5f9; }
    .meta-box h3 { margin: 0 0 5px 0; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; }
    .meta-box p { margin: 0; font-size: 14px; font-weight: 600; color: #1e293b; }

    .patient-doctor-info { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px; }
    .info-section { border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; }
    .info-section h3 { margin: 0 0 12px 0; font-size: 14px; font-weight: 700; color: #475569; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px; }
    .info-item { margin-bottom: 6px; display: flex; font-size: 13px; }
    .info-label { font-weight: 600; color: #64748b; width: 90px; shrink: 0; }
    .info-value { color: #1e293b; font-weight: 500; }

    .prescription-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
    .prescription-table th, .prescription-table td { border: 1px solid #e2e8f0; padding: 12px 10px; font-size: 12.5px; }
    .prescription-table th { background-color: #f8fafc; font-weight: 700; text-align: center; color: #475569; text-transform: uppercase; font-size: 11px; }
    
    .notes-section { margin-top: 20px; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; background: #fff; }
    .notes-section h3 { margin: 0 0 8px 0; font-size: 14px; font-weight: 700; color: #475569; }
    .notes-section p { margin: 0; font-size: 13px; color: #1e293b; line-height: 1.6; }

    .signature-section { margin-top: 60px; display: flex; justify-content: space-between; align-items: flex-end; }
    .signature-box { text-align: center; width: 180px; }
    .sign-line { border-top: 1px solid #475569; margin-bottom: 5px; }
    .sign-label { font-size: 11px; color: #64748b; font-weight: 500; }

    @media print { body { padding: 0; margin: 0; } .print-container { height: 100vh; padding: 0; max-width: 100%; } }
  </style>
</head>
<body>
  <div class="print-container">
    ${headerHtml}

    <div class="content">
      <div class="document-title">
        <h2>Medical Prescription</h2>
        <p class="document-subtitle">Professional Treatment Plan</p>
      </div>

      <div class="prescription-meta">
        <div class="meta-box">
          <h3>Prescription No.</h3>
          <p>#${prescription.prescriptionNo}</p>
        </div>
        <div class="meta-box" style="text-align: right;">
          <h3>Date Issued</h3>
          <p>${formatDate(prescription.prescriptionDate)}</p>
        </div>
      </div>

      <div class="patient-doctor-info">
        <div class="info-section">
          <h3>Patient Detail</h3>
          <div class="info-item"><span class="info-label">Name:</span><span class="info-value">${prescription.patientName}</span></div>
          ${prescription.patientAge || prescription.patientGender ? `
            <div class="info-item"><span class="info-label">Age/Gen:</span><span class="info-value">${[prescription.patientAge, prescription.patientGender].filter(Boolean).join(" / ")}</span></div>
          ` : ""}
          ${prescription.patientPhone ? `
            <div class="info-item"><span class="info-label">Contact:</span><span class="info-value">${prescription.patientPhone}</span></div>
          ` : ""}
        </div>
        <div class="info-section">
          <h3>Doctor Detail</h3>
          <div class="info-item"><span class="info-label">Physician:</span><span class="info-value">${prescription.doctorName}</span></div>
          ${prescription.doctorSpeciality ? `
            <div class="info-item"><span class="info-label">Speciality:</span><span class="info-value">${prescription.doctorSpeciality}</span></div>
          ` : ""}
          ${prescription.appointmentInfo && prescription.appointmentTypeName ? `
            <div class="info-item"><span class="info-label">Visit Type:</span><span class="info-value">${prescription.appointmentTypeName}</span></div>
          ` : ""}
        </div>
      </div>

      <table class="prescription-table">
        <thead>
          <tr>
            <th style="text-align: left;">Medicine Name & Description</th>
            <th width="80">Dosage</th>
            <th width="100">Frequency</th>
            <th width="80">Duration</th>
            <th width="80">Time</th>
          </tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
      </table>

      ${prescription.notes ? `<div class="notes-section"><h3>Clinical Notes & Instructions</h3><p>${prescription.notes}</p></div>` : ""}

      <div class="signature-section">
        <div class="signature-box">
          <div class="sign-line"></div>
          <p class="sign-label">Patient/Guardian Signature</p>
        </div>
        <div class="signature-box">
          <div class="sign-line"></div>
          <p class="sign-label">Authorized Physician Signature</p>
        </div>
      </div>
    </div>

    ${footerHtml}
  </div>
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
    <div className="flex flex-col gap-6 pb-12">
      {/* Header */}
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-3">
          <Button isIconOnly variant="bordered" onClick={() => navigate(-1)}>
            <IoArrowBackOutline className="w-4 h-4" />
          </Button>
          <div>
            <h1 className={`${title({ size: "lg" })} text-primary`}>Prescription Details</h1>
            <p className="text-[14.5px] font-bold text-text-main tracking-wide mt-1">
              #{prescription.prescriptionNo}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button
            startContent={<IoCreateOutline className="w-4 h-4" />}
            variant="bordered"
            onClick={handleEdit}
          >
            Edit
          </Button>
          <Button
            startContent={<IoPrintOutline className="w-4 h-4" />}
            variant="bordered"
            onClick={handlePrint}
          >
            Print
          </Button>
          <Button
            color="primary"
            startContent={<IoDownloadOutline className="w-4 h-4" />}
            onClick={handleDownload}
          >
            Download
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Col */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-surface border border-border-base rounded-[10px] shadow-sm">
            <div className="px-5 py-4 border-b border-border-base/50 bg-surface-2/50">
              <h4 className="font-semibold text-[15px] text-text-main leading-none">
                Patient Information
              </h4>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <p className="text-[12.5px] text-text-muted font-medium tracking-wide pb-1">
                    Name
                  </p>
                  <p className="font-medium text-[14.5px] text-text-main">
                    {prescription.patientName}
                  </p>
                </div>
                <div>
                  <p className="text-[12.5px] text-text-muted font-medium tracking-wide pb-1">
                    Age
                  </p>
                  <p className="font-medium text-[14.5px] text-text-main">
                    {prescription.patientAge}
                  </p>
                </div>
                <div>
                  <p className="text-[12.5px] text-text-muted font-medium tracking-wide pb-1">
                    Gender
                  </p>
                  <p className="font-medium text-[14.5px] text-text-main capitalize">
                    {prescription.patientGender}
                  </p>
                </div>
                <div>
                  <p className="text-[12.5px] text-text-muted font-medium tracking-wide pb-1">
                    Phone
                  </p>
                  <p className="font-medium text-[14.5px] text-text-main">
                    {prescription.patientPhone}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-surface border border-border-base rounded-[10px] shadow-sm">
            <div className="px-5 py-4 border-b border-border-base/50 bg-surface-2/50">
              <h4 className="font-semibold text-[15px] text-text-main leading-none">
                Doctor Information
              </h4>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-[12.5px] text-text-muted font-medium tracking-wide pb-1">
                    Name
                  </p>
                  <p className="font-medium text-[14.5px] text-text-main">
                    {prescription.doctorName}
                  </p>
                </div>
                <div>
                  <p className="text-[12.5px] text-text-muted font-medium tracking-wide pb-1">
                    Speciality
                  </p>
                  <p className="font-medium text-[14.5px] text-text-main">
                    {prescription.doctorSpeciality}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {prescription.appointmentInfo && (
            <div className="bg-surface border border-border-base rounded-[10px] shadow-sm">
              <div className="px-5 py-4 border-b border-border-base/50 bg-surface-2/50">
                <h4 className="font-semibold text-[15px] text-text-main leading-none">
                  Appointment Information
                </h4>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                  <div>
                    <p className="text-[12.5px] text-text-muted font-medium tracking-wide pb-1">
                      Appointment Date
                    </p>
                    <p className="font-medium text-[14.5px] text-text-main">
                      {formatDate(prescription.appointmentInfo.appointmentDate)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[12.5px] text-text-muted font-medium tracking-wide pb-1">
                      Type
                    </p>
                    <p className="font-medium text-[14.5px] text-text-main capitalize">
                      {prescription.appointmentTypeName ||
                        (prescription.appointmentInfo.appointmentType
                          ? prescription.appointmentInfo.appointmentType.replace(
                            /-/g,
                            " ",
                          )
                          : "Not specified")}
                    </p>
                  </div>
                  <div>
                    <p className="text-[12.5px] text-text-muted font-medium tracking-wide pb-1">
                      Status
                    </p>
                    <p className="font-medium text-[14.5px] text-text-main capitalize">
                      {prescription.appointmentInfo.status || "N/A"}
                    </p>
                  </div>
                  {prescription.appointmentInfo.reason && (
                    <div>
                      <p className="text-[12.5px] text-text-muted font-medium tracking-wide pb-1">
                        Reason
                      </p>
                      <p className="font-medium text-[14.5px] text-text-main">
                        {prescription.appointmentInfo.reason}
                      </p>
                    </div>
                  )}
                </div>
                {prescription.appointmentInfo.notes && (
                  <div className="pt-2 border-t border-border-base/50">
                    <p className="text-[12.5px] text-text-muted font-medium tracking-wide pb-1">
                      Notes
                    </p>
                    <p className="font-medium text-[14.5px] text-text-main">
                      {prescription.appointmentInfo.notes}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="bg-surface border border-border-base rounded-[10px] shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-border-base/50 bg-surface-2/50">
              <h4 className="font-semibold text-[15px] text-text-main leading-none">
                Prescribed Medicines
              </h4>
            </div>
            <div className="overflow-x-auto min-w-full">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-2/50 border-b border-border-base">
                    <th className="px-5 py-3 text-[11px] font-bold text-text-muted uppercase tracking-wider w-1/4">
                      Medicine
                    </th>
                    <th className="px-5 py-3 text-[11px] font-bold text-text-muted uppercase tracking-wider w-1/6">
                      Dosage
                    </th>
                    <th className="px-5 py-3 text-[11px] font-bold text-text-muted uppercase tracking-wider w-1/6">
                      Duration
                    </th>
                    <th className="px-5 py-3 text-[11px] font-bold text-text-muted uppercase tracking-wider w-1/6">
                      Time
                    </th>
                    <th className="px-5 py-3 text-[11px] font-bold text-text-muted uppercase tracking-wider w-1/6">
                      Frequency
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-base">
                  {prescription.items?.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-surface-2/30 transition-colors"
                    >
                      <td className="px-5 py-3">
                        <div className="font-medium text-[13.5px] text-text-main">
                          {item.medicineName}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-[13.5px] text-text-muted">
                        {item.dosage}
                      </td>
                      <td className="px-5 py-3 text-[13.5px] text-text-muted">
                        {item.duration}
                      </td>
                      <td className="px-5 py-3 text-[13.5px] text-text-muted capitalize">
                        {item.time}
                      </td>
                      <td className="px-5 py-3 text-[13.5px] text-text-muted capitalize">
                        {item.frequency}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {prescription.notes && (
            <div className="bg-surface border border-border-base rounded-[10px] shadow-sm">
              <div className="px-5 py-4 border-b border-border-base/50 bg-surface-2/50">
                <h4 className="font-semibold text-[15px] text-text-main leading-none">
                  Notes & Instructions
                </h4>
              </div>
              <div className="p-6">
                <p className="text-[13.5px] text-text-main leading-relaxed">
                  {prescription.notes}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right Col */}
        <div className="space-y-6">
          <div className="bg-surface border border-border-base rounded-[10px] shadow-sm">
            <div className="px-5 py-4 border-b border-border-base/50 bg-surface-2/50">
              <h4 className="font-semibold text-[15px] text-text-main leading-none">
                Summary
              </h4>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-center text-[13.5px]">
                <span className="text-text-muted font-medium tracking-wide">
                  Prescription No.
                </span>
                <span className="font-bold text-text-main">
                  {prescription.prescriptionNo}
                </span>
              </div>
              <div className="flex justify-between items-center text-[13.5px] pt-4 border-t border-border-base/50">
                <span className="text-text-muted font-medium tracking-wide">
                  Date
                </span>
                <span className="font-semibold text-text-main">
                  {formatDate(prescription.prescriptionDate)}
                </span>
              </div>
              {prescription.appointmentInfo && (
                <div className="flex justify-between items-center text-[13.5px] pt-4 border-t border-border-base/50">
                  <span className="text-text-muted font-medium tracking-wide">
                    Appt. Date
                  </span>
                  <span className="font-semibold text-text-main">
                    {formatDate(prescription.appointmentInfo.appointmentDate)}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center text-[13.5px] pt-4 border-t border-border-base/50">
                <span className="text-text-muted font-medium tracking-wide">
                  Status
                </span>
                <span
                  className={`inline-flex px-2 py-0.5 border rounded-[10px] text-[11.5px] font-medium capitalize ${statusColors[prescription.status] || statusColors.completed}`}
                >
                  {prescription.status}
                </span>
              </div>
              <div className="flex justify-between items-center text-[13.5px] pt-4 border-t border-border-base/50">
                <span className="text-text-muted font-medium tracking-wide">
                  Total Medicines
                </span>
                <span className="font-bold text-text-main">
                  {prescription.items?.length || 0}
                </span>
              </div>
              <div className="flex justify-between items-center text-[13.5px] pt-4 border-t border-border-base/50">
                <span className="text-text-muted font-medium tracking-wide">
                  Created
                </span>
                <span className="font-semibold text-text-main">
                  {formatDate(prescription.createdAt)}
                </span>
              </div>
              <div className="flex justify-between items-center text-[13.5px] pt-4 border-t border-border-base/50">
                <span className="text-text-muted font-medium tracking-wide">
                  Last Updated
                </span>
                <span className="font-semibold text-text-main">
                  {formatDate(prescription.updatedAt)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
