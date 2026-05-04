/**
 * PatientOverviewTab — Clinic Clarity, zero HeroUI
 * Cards: flat bordered, no shadow. Modal: custom inline.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  IoPersonOutline,
  IoLocationOutline,
  IoMedicalOutline,
  IoReceiptOutline,
  IoDocumentTextOutline,
  IoTrashOutline,
  IoWarningOutline,
} from "react-icons/io5";

import { Patient } from "@/types/models";
import { PrintLayoutConfig } from "@/types/printLayout";
import { useAuthContext } from "@/context/AuthContext";
import { clinicService } from "@/services/clinicService";
import { patientService } from "@/services/patientService";
import { doctorService } from "@/services/doctorService";
import { expertService } from "@/services/expertService";
import { addToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Select, SelectItem } from "@/components/ui";
import {
  generatePatientSlipHTML,
  PrintFormat,
} from "@/utils/invoicePrinting";
import { getPrintBrandingCSS, getPrintHeaderHTML, getPrintFooterHTML } from "@/utils/printBranding";

interface PatientOverviewTabProps {
  patient: Patient;
}

// ── Shared helpers ───────────────────────────────────────────────────────────
function InfoCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-surface border border-border-base rounded overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5 bg-surface-2 border-b border-border-base/50">
        <span className="text-primary">{icon}</span>
        <h3 className="text-[13px] font-semibold text-text-main">{title}</h3>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value?: string | number | null;
}) {
  if (!value && value !== 0) return null;

  return (
    <div className="flex flex-col">
      <span className="text-[10.5px] text-text-muted font-medium uppercase tracking-[0.05em]">
        {label}
      </span>
      <span className="text-[12.5px] text-text-main font-medium mt-0.5 capitalize">
        {value}
      </span>
    </div>
  );
}

// ── Inline delete‑confirm modal ───────────────────────────────────────────────
function ConfirmDeleteModal({
  name,
  onConfirm,
  onCancel,
  loading,
}: {
  name: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-surface dark:bg-surface-2 rounded border border-border-base shadow-2xl max-w-sm w-full overflow-hidden">
        <div className="px-4 py-3 border-b border-border-base bg-surface-2">
          <h3 className="text-[14px] font-semibold text-text-main">
            Delete Patient?
          </h3>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded">
            <IoWarningOutline className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-[12.5px] font-semibold text-red-700">
                This action cannot be undone.
              </p>
              <p className="text-[12px] text-red-600 mt-0.5">
                Permanently delete <strong>{name}</strong> and all associated
                appointments, prescriptions, and records?
              </p>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-4 pb-4">
          <Button
            color="default"
            disabled={loading}
            size="sm"
            variant="bordered"
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            color="danger"
            isLoading={loading}
            size="sm"
            startContent={
              !loading ? <IoTrashOutline className="w-3.5 h-3.5" /> : undefined
            }
            onClick={onConfirm}
          >
            {loading ? "Deleting…" : "Yes, Delete"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PatientOverviewTab({
  patient,
}: PatientOverviewTabProps) {
  const { clinicId } = useAuthContext();
  const navigate = useNavigate();
  const [layoutConfig, setLayoutConfig] = useState<PrintLayoutConfig | null>(
    null,
  );
  const [clinic, setClinic] = useState<any>(null);
  const [assignedDoctor, setAssignedDoctor] = useState<any>(null);
  const [assignedExpert, setAssignedExpert] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [printFormat, setPrintFormat] = useState<PrintFormat>("A4");

  useEffect(() => {
    if (!clinicId) return;
    Promise.all([
      clinicService.getClinicById(clinicId),
      clinicService.getPrintLayoutConfig(clinicId),
      patient.doctorId
        ? doctorService.getDoctorById(patient.doctorId).catch(() => null)
        : Promise.resolve(null),
      patient.assignedExpertId
        ? expertService
          .getExpertById(patient.assignedExpertId)
          .catch(() => null)
        : Promise.resolve(null),
    ])
      .then(([c, lc, d, e]) => {
        setClinic(c);
        setLayoutConfig(lc);
        setAssignedDoctor(d);
        setAssignedExpert(e);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [clinicId, patient.doctorId, patient.assignedExpertId]);

  useEffect(() => {
    if (layoutConfig?.defaultPrintFormat) {
      setPrintFormat(layoutConfig.defaultPrintFormat as PrintFormat);
    }
  }, [layoutConfig]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const calculateAge = (dob: Date): string => {
    if (!dob) return "";
    const b = new Date(dob);
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

  const getAge = (p: Patient): string => {
    if (typeof p.age === "string" && p.age !== "") return p.age;
    if (typeof p.age === "number" && p.age > 0) return `${p.age} Years`;
    if (p.dob) return calculateAge(p.dob);

    return "";
  };

  const fmtDate = (d: Date) =>
    new Date(d).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  const fmtDateTime = (d: Date) =>
    new Date(d).toLocaleString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

  // ── Print ──────────────────────────────────────────────────────────────────
  const openPrint = (type: "slip" | "rx") => {
    const w = window.open("", "_blank", "width=800,height=600");

    if (w) {
      if (type === "slip") {
        const content = generatePatientSlipHTML(
          patient,
          clinic,
          printFormat,
          layoutConfig,
        );
        w.document.write(content);
      } else {
        w.document.write(generatePrint(patient, type));
      }
      w.document.close();
    } else
      addToast({
        title: "Error",
        description: "Pop-up blocked. Please allow pop-ups.",
        color: "danger",
      });
  };

  const generatePrint = (patient: Patient, type: "slip" | "rx") => {
    const row = (l: string, v: string, l2 = "", v2 = "") =>
      `<tr><td class="label">${l}</td><td class="value">${v}</td><td class="label">${l2}</td><td class="value">${v2}</td></tr>`;
    const ageGender = [
      getAge(patient),
      patient.gender || "",
    ]
      .filter(Boolean)
      .join(" / ");
    const table = `<table class="pt"><tbody>
      ${row("Reg#:", patient.regNumber || "", "Name:", patient.name)}
      ${row("Age/Gender:", ageGender, "Date:", new Date().toISOString().split("T")[0].replace(/-/g, "/"))}
      ${row("Contact:", patient.mobile, "Address:", patient.address || "")}
      ${row("Ref By:", patient.referredBy || "", "", "")}
    </tbody></table>`;

    const brandingCSS = layoutConfig ? getPrintBrandingCSS(layoutConfig) : "";
    const headerHTML = layoutConfig ? getPrintHeaderHTML(layoutConfig, clinic) : "";
    const footerHTML = layoutConfig ? getPrintFooterHTML(layoutConfig) : "";

    if (type === "slip")
      return `<!DOCTYPE html><html><head><title>Patient Slip - ${patient.name}</title><style>${brandingCSS}</style></head><body><div class="print-container">${headerHTML}<div class="content">${table}</div>${footerHTML}</div><script>window.onload=()=>setTimeout(()=>window.print(),500);window.onafterprint=()=>window.close();<\/script></body></html>`;

    return `<!DOCTYPE html><html><head><title>RX — ${patient.name}</title><style>${brandingCSS}
      .container{height:100vh;padding:10mm;box-sizing:border-box;display:flex;flex-direction:column}
      .content{flex:1}.footer{border-top:1px solid #333;padding-top:10px;margin-top:auto;text-align:center;font-size:12px;color:#666}
    </style></head><body><div class="print-container">
      ${headerHTML}
      <div class="content">${table}<div style="text-align:center;margin:20px 0"><h2 style="font-size:18px;font-weight:600;text-transform:uppercase">Medical Prescription</h2></div></div>
      ${footerHTML}
    </div><script>window.onload=()=>setTimeout(()=>window.print(),500);window.onafterprint=()=>window.close();<\/script></body></html>`;
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const confirmDelete = async () => {
    if (!patient || !clinicId) return;
    setDeleting(true);
    try {
      await patientService.deletePatient(patient.id);
      addToast({
        title: "Patient deleted",
        description: `"${patient.name}" removed.`,
        color: "success",
      });
      navigate("/dashboard/patients");
    } catch {
      addToast({
        title: "Error",
        description: "Failed to delete patient.",
        color: "danger",
      });
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">
      {/* Sub-header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-section-title text-text-main">
            Patient Overview
          </h2>
          <p className="text-[12.5px] text-text-muted">
            Basic information and quick summary
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-40 sm:w-48">
            <Select
              label="Print Format"
              selectedKeys={[printFormat]}
              size="sm"
              onSelectionChange={(keys) => {
                const format = Array.from(keys)[0] as PrintFormat;
                if (format) setPrintFormat(format);
              }}
            >
              <SelectItem key="A4">A4 Full Page</SelectItem>
              <SelectItem key="THERMAL_80MM">Thermal 80mm</SelectItem>
              <SelectItem key="THERMAL_58MM">Thermal 58mm</SelectItem>
              <SelectItem key="THERMAL_4INCH">Label (4-inch)</SelectItem>
            </Select>
          </div>
          <Button
            color="default"
            disabled={loading}
            size="sm"
            startContent={<IoReceiptOutline className="w-3.5 h-3.5" />}
            variant="bordered"
            onClick={() => openPrint("slip")}
          >
            Print Slip
          </Button>
          <Button
            color="default"
            disabled={loading}
            size="sm"
            startContent={<IoDocumentTextOutline className="w-3.5 h-3.5" />}
            variant="bordered"
            onClick={() => openPrint("rx")}
          >
            Print Empty RX
          </Button>
        </div>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Personal */}
        <InfoCard
          icon={<IoPersonOutline className="w-4 h-4" />}
          title="Personal Information"
        >
          <div className="grid grid-cols-2 gap-3">
            <InfoRow label="Full Name" value={patient.name} />
            <InfoRow label="Registration #" value={patient.regNumber} />
            <InfoRow
              label="Age"
              value={getAge(patient) || undefined}
            />
            <InfoRow label="Gender" value={patient.gender} />
            <InfoRow label="Blood Group" value={patient.bloodGroup} />
            <InfoRow
              label="Date of Birth"
              value={patient.dob ? fmtDate(patient.dob) : undefined}
            />
            <InfoRow
              label="Registration Date"
              value={
                patient.createdAt ? fmtDateTime(patient.createdAt) : undefined
              }
            />
          </div>
        </InfoCard>

        {/* Medical */}
        <InfoCard
          icon={<IoMedicalOutline className="w-4 h-4" />}
          title="Medical Information"
        >
          <p className="text-[10.5px] text-text-muted font-medium uppercase tracking-[0.05em] mb-2">
            Medical Conditions
          </p>
          {patient.medicalConditions && patient.medicalConditions.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {patient.medicalConditions.map((c, i) => (
                <span
                  key={i}
                  className="text-[11px] bg-saffron-100 text-saffron-700 border border-saffron-200 px-2 py-0.5 rounded font-medium"
                >
                  {c}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[12.5px] text-text-muted italic">
              No medical conditions recorded
            </p>
          )}

          <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-border-base/50">
            <InfoRow
              label="Assigned Doctor"
              value={assignedDoctor ? assignedDoctor.name : "None"}
            />
            <InfoRow
              label="Assigned Expert"
              value={assignedExpert ? assignedExpert.name : "None"}
            />
          </div>
        </InfoCard>

        {/* Contact */}
        <InfoCard
          icon={<IoLocationOutline className="w-4 h-4" />}
          title="Contact Information"
        >
          <div className="grid grid-cols-2 gap-3">
            <InfoRow label="Mobile" value={patient.mobile} />
            {patient.email && <InfoRow label="Email" value={patient.email} />}
            {(patient as any).phone && (
              <InfoRow label="Phone" value={(patient as any).phone} />
            )}
            <InfoRow label="Address" value={patient.address} />
            {(patient as any).occupation && (
              <InfoRow label="Occupation" value={(patient as any).occupation} />
            )}
            {(patient as any).careOf && (
              <InfoRow label="C/O" value={(patient as any).careOf} />
            )}
            {(patient as any).relation && (
              <InfoRow label="Relation" value={(patient as any).relation} />
            )}
            {patient.referredBy && (
              <InfoRow label="Referred By" value={patient.referredBy} />
            )}
          </div>
        </InfoCard>
      </div>

      {/* Danger zone */}
      <div className="bg-surface dark:bg-surface-2 border border-red-200 dark:border-red-500/20 rounded overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50/50 dark:bg-red-500/5 border-b border-red-100 dark:border-red-500/10">
          <div className="p-1 bg-red-100 dark:bg-red-500/10 rounded">
            <IoTrashOutline className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h3 className="text-[13px] font-semibold text-red-800 dark:text-red-400">
              Danger Zone
            </h3>
            <p className="text-[11px] text-red-600 dark:text-red-400/70">
              Permanently delete this patient and all associated data
            </p>
          </div>
        </div>
        <div className="p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <p className="text-[12.5px] text-red-800 font-semibold">
              Delete Patient
            </p>
            <p className="text-[12px] text-red-600 mt-0.5">
              This will permanently delete the patient's record, appointments,
              prescriptions, and all associated data.
            </p>
          </div>
          <Button
            className="shrink-0"
            color="danger"
            size="sm"
            startContent={<IoTrashOutline className="w-3.5 h-3.5" />}
            onClick={() => setShowDeleteModal(true)}
          >
            Delete Patient
          </Button>
        </div>
      </div>

      {/* Delete modal */}
      {showDeleteModal && (
        <ConfirmDeleteModal
          loading={deleting}
          name={patient.name}
          onCancel={() => setShowDeleteModal(false)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}
