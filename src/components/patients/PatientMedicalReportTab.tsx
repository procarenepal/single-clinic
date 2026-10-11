/**
 * PatientMedicalReportTab — Clinic Clarity, zero HeroUI
 * All field types rendered with native HTML inputs.
 * Removed: @heroui/button, @heroui/input, @heroui/radio, @heroui/checkbox,
 *          @heroui/select, @heroui/spinner, @heroui/toast
 */
import React, { useState, useEffect } from "react";
import {
  IoSaveOutline,
  IoWarningOutline,
  IoCheckmarkCircleOutline,
  IoTimeOutline,
} from "react-icons/io5";

import { addToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { MedicalReportField, MedicalReportResponse } from "@/types/models";
import { medicalReportFieldService } from "@/services/medicalReportFieldService";
import { MedicalReportResponseService } from "@/services/medicalReportResponseService";
import { appointmentService } from "@/services/appointmentService";
import { patientService } from "@/services/patientService";
import { useAuthContext } from "@/context/AuthContext";

interface PatientMedicalReportTabProps {
  patientId: string;
  clinicId: string;
  isReadOnly?: boolean;
  compactLayout?: boolean;
}

// ── Shared field input styles ─────────────────────────────────────────────────
const INPUT_CLS = `w-full h-9 px-2.5 text-[12.5px] border border-border-base rounded bg-surface text-text-main
  placeholder:text-text-muted/40 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/10
  disabled:bg-surface-2 disabled:text-text-muted/60`;

const TEXTAREA_CLS = `w-full px-2.5 py-2 text-[12.5px] border border-border-base rounded bg-surface text-text-main
  placeholder:text-text-muted/40 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/10
  resize-y disabled:bg-surface-2 disabled:text-text-muted/60`;

const SELECT_CLS = `w-full h-9 px-2.5 text-[12.5px] border border-border-base rounded bg-surface text-text-main
  focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/10
  disabled:bg-surface-2 disabled:text-text-muted/60`;

// ── Field wrapper ─────────────────────────────────────────────────────────────
function FieldWrapper({
  field,
  children,
}: {
  field: MedicalReportField;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[12px] font-medium text-text-main">
        {field.fieldLabel}
        {field.isRequired && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {field.description && (
        <p className="text-[10.5px] text-text-muted">{field.description}</p>
      )}
      {children}
    </div>
  );
}

// ── Yes/No inline layout ──────────────────────────────────────────────────────
function YesNoField({
  field,
  value,
  onChange,
  disabled,
}: {
  field: MedicalReportField;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex gap-3">
      {["yes", "no"].map((opt) => (
        <label
          key={opt}
          className={`flex items-center gap-1.5 cursor-pointer select-none ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <input
            checked={value === opt}
            className="w-3.5 h-3.5 accent-primary"
            disabled={disabled}
            name={field.fieldKey}
            type="radio"
            value={opt}
            onChange={() => onChange(opt)}
          />
          <span className="text-[12.5px] text-text-main capitalize">{opt}</span>
        </label>
      ))}
    </div>
  );
}

// ── Saved-report display helpers ──────────────────────────────────────────────
const isFilled = (v: any): boolean =>
  Array.isArray(v)
    ? v.length > 0
    : typeof v === "string"
      ? v.trim() !== ""
      : v !== null && v !== undefined;

/** A saved answer as readable text (checkbox lists joined, yes/no capitalized). */
function formatAnswer(field: MedicalReportField, value: any): string {
  if (Array.isArray(value)) return value.join(", ");
  if (field.fieldType === "yes-no")
    return String(value).replace(/^./, (c) => c.toUpperCase());
  if (field.fieldType === "date") {
    const d = new Date(value);

    return isNaN(d.getTime()) ? String(value) : d.toLocaleDateString();
  }

  return String(value);
}

/** One previously saved report, read-only. */
function SavedReportCard({
  report,
  fields,
  compact,
}: {
  report: MedicalReportResponse;
  fields: MedicalReportField[];
  compact: boolean;
}) {
  const answered = fields.filter((f) =>
    isFilled(report.fieldValues?.[f.fieldKey]),
  );
  const savedAt = report.submittedAt || report.updatedAt;

  return (
    <div className="min-w-0 border border-border-base rounded bg-surface overflow-hidden">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 px-3 py-2 bg-surface-2 border-b border-border-base/50 text-[11.5px] text-text-muted">
        <IoTimeOutline className="w-3.5 h-3.5 shrink-0" />
        <span className="font-medium text-text-main">
          {savedAt.getTime() > 0
            ? `${savedAt.toLocaleDateString()} ${savedAt.toLocaleTimeString()}`
            : "Earlier report"}
        </span>
        {report.submittedByName && <span>· by {report.submittedByName}</span>}
      </div>
      {answered.length === 0 ? (
        <p className="px-3 py-3 text-[12px] text-text-muted">
          No answers were recorded in this report.
        </p>
      ) : (
        <dl
          className={`grid grid-cols-1 ${compact ? "" : "lg:grid-cols-2"} gap-x-6 gap-y-3 p-3`}
        >
          {answered.map((f) => (
            <div key={f.id} className="min-w-0">
              <dt className="text-[11px] font-medium text-text-muted">
                {f.fieldLabel}
              </dt>
              <dd className="text-[12.5px] text-text-main whitespace-pre-wrap break-words">
                {formatAnswer(f, report.fieldValues[f.fieldKey])}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export const PatientMedicalReportTab: React.FC<
  PatientMedicalReportTabProps
> = ({ patientId, clinicId, isReadOnly = false, compactLayout = false }) => {
  const { currentUser, userData: authUserData } = useAuthContext();
  const [fields, setFields] = useState<MedicalReportField[]>([]);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [reports, setReports] = useState<MedicalReportResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  useEffect(() => {
    loadFieldsAndResponses();
  }, [clinicId, patientId]);

  const loadFieldsAndResponses = async () => {
    setLoading(true);
    try {
      const [flds, savedReports, appointments, patient] = await Promise.all([
        medicalReportFieldService.getFields(clinicId),
        MedicalReportResponseService.getPatientReports(
          clinicId,
          patientId,
        ).catch((error) => {
          // Nothing readable yet is normal for a patient's first visit.
          if (error?.code === "permission-denied") return [];
          throw error;
        }),
        appointmentService.getAppointmentsByPatient(patientId),
        patientService.getPatientById(patientId),
      ]);

      // Deduplicate fields by fieldKey (in case seeder ran concurrently and created duplicates)
      const uniqueFields: MedicalReportField[] = [];
      const seenKeys = new Set<string>();

      for (const field of flds) {
        if (!seenKeys.has(field.fieldKey)) {
          seenKeys.add(field.fieldKey);
          uniqueFields.push(field);
        }
      }

      setFields(uniqueFields);

      setReports(savedReports);

      // The form is always for a new report, so it starts empty. Only the very
      // first report is pre-filled from the appointment / patient profile.
      const initialResponses: Record<string, any> = {};
      const isFirstReport = savedReports.length === 0;

      // Auto-populate from recent appointments if fields are empty
      if (isFirstReport && appointments && appointments.length > 0) {
        // Sort to get the most recent appointment
        const sortedAppts = [...appointments].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        const recentAppt = sortedAppts[0];

        // Auto-populate Chief Complaint
        if (!initialResponses["chief-complaint"]) {
          const complaintFromVitals = (
            recentAppt as any
          ).vitals?.complaints?.trim();
          const reasonForVisit = recentAppt.reason?.trim();

          if (complaintFromVitals) {
            initialResponses["chief-complaint"] = complaintFromVitals;
            setHasChanges(true);
          } else if (
            reasonForVisit &&
            reasonForVisit !== "Walk-in General Checkup"
          ) {
            initialResponses["chief-complaint"] = reasonForVisit;
            setHasChanges(true);
          }
        }
      }

      // Auto-populate from patient profile if fields are empty
      if (isFirstReport && patient) {
        if (!initialResponses["blood-group"] && patient.bloodGroup) {
          initialResponses["blood-group"] = patient.bloodGroup;
          setHasChanges(true);
        }

        if (
          !initialResponses["past-medical-history"] &&
          patient.medicalConditions &&
          patient.medicalConditions.length > 0
        ) {
          initialResponses["past-medical-history"] =
            patient.medicalConditions.join(", ");
          setHasChanges(true);
        }
      }

      const latest = savedReports[0];

      setLastSaved(latest ? latest.submittedAt || latest.updatedAt : null);
      setResponses(initialResponses);
    } catch {
      addToast({
        title: "Error",
        description: "Failed to load medical report.",
        color: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (key: string, value: any) => {
    if (isReadOnly) return;
    setResponses((p) => ({ ...p, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!currentUser || isReadOnly) return;

    // Drop empty answers; there is nothing worth saving if none are left.
    const answers = Object.fromEntries(
      Object.entries(responses).filter(([, v]) => isFilled(v)),
    );

    if (Object.keys(answers).length === 0) {
      addToast({
        title: "Nothing to save",
        description: "Fill in at least one field first.",
        color: "warning",
      });

      return;
    }
    setSaving(true);
    try {
      const saved = await MedicalReportResponseService.addPatientReport(
        clinicId,
        patientId,
        answers,
        currentUser.uid,
        authUserData?.displayName,
      );

      // List it below and clear the form for the next report.
      setReports((prev) => [saved, ...prev]);
      setResponses({});
      setHasChanges(false);
      setLastSaved(saved.submittedAt);
      addToast({ title: "Medical report saved", color: "success" });
    } catch {
      addToast({ title: "Save failed", color: "danger" });
    } finally {
      setSaving(false);
    }
  };

  // ── Field renderer ─────────────────────────────────────────────────────────
  const renderField = (field: MedicalReportField): React.ReactNode => {
    const val = responses[field.fieldKey] ?? "";
    const dis = isReadOnly;

    switch (field.fieldType) {
      case "text":
        return (
          <input
            className={INPUT_CLS}
            disabled={dis}
            placeholder={field.placeholder}
            type="text"
            value={val}
            onChange={(e) => handleChange(field.fieldKey, e.target.value)}
          />
        );
      case "number":
        return (
          <input
            className={INPUT_CLS}
            disabled={dis}
            placeholder={field.placeholder}
            type="number"
            value={val}
            onChange={(e) =>
              handleChange(field.fieldKey, parseFloat(e.target.value) || "")
            }
          />
        );
      case "date":
        return (
          <input
            className={INPUT_CLS}
            disabled={dis}
            type="date"
            value={val ? new Date(val).toISOString().split("T")[0] : ""}
            onChange={(e) =>
              handleChange(
                field.fieldKey,
                e.target.value ? new Date(e.target.value).toISOString() : "",
              )
            }
          />
        );
      case "textarea":
        return (
          <textarea
            className={TEXTAREA_CLS}
            disabled={dis}
            placeholder={field.placeholder}
            rows={3}
            value={val}
            onChange={(e) => handleChange(field.fieldKey, e.target.value)}
          />
        );
      case "select":
        return (
          <select
            className={SELECT_CLS}
            disabled={dis}
            value={val}
            onChange={(e) => handleChange(field.fieldKey, e.target.value)}
          >
            <option value="">Select an option</option>
            {field.options?.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        );
      case "radio":
        return (
          <div className="flex flex-wrap gap-3">
            {field.options?.map((opt) => (
              <label
                key={opt}
                className={`flex items-center gap-1.5 cursor-pointer select-none ${dis ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <input
                  checked={val === opt}
                  className="w-3.5 h-3.5 accent-primary"
                  disabled={dis}
                  name={field.fieldKey}
                  type="radio"
                  value={opt}
                  onChange={() => handleChange(field.fieldKey, opt)}
                />
                <span className="text-[12.5px] text-text-main">{opt}</span>
              </label>
            ))}
          </div>
        );
      case "checkbox": {
        const checked: string[] = Array.isArray(val) ? val : [];

        return (
          <div className="flex flex-wrap gap-3">
            {field.options?.map((opt) => (
              <label
                key={opt}
                className={`flex items-center gap-1.5 cursor-pointer select-none ${dis ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <input
                  checked={checked.includes(opt)}
                  className="w-3.5 h-3.5 accent-primary rounded"
                  disabled={dis}
                  type="checkbox"
                  value={opt}
                  onChange={(e) =>
                    handleChange(
                      field.fieldKey,
                      e.target.checked
                        ? [...checked, opt]
                        : checked.filter((x) => x !== opt),
                    )
                  }
                />
                <span className="text-[12.5px] text-text-main">{opt}</span>
              </label>
            ))}
          </div>
        );
      }
      case "yes-no":
        return (
          <YesNoField
            disabled={dis}
            field={field}
            value={val}
            onChange={(v) => handleChange(field.fieldKey, v)}
          />
        );
      default:
        return null;
    }
  };

  // ── States ─────────────────────────────────────────────────────────────────
  if (loading)
    return (
      <div className="flex justify-center py-12">
        <Spinner label="Loading…" size="lg" />
      </div>
    );

  if (fields.length === 0) {
    return (
      <div className="py-16 text-center">
        <IoWarningOutline className="mx-auto w-10 h-10 text-text-muted/30 mb-3" />
        <h3 className="text-[13px] font-semibold text-text-main mb-1">
          No Medical Report Fields
        </h3>
        <p className="text-[12px] text-text-muted">
          Contact your clinic administrator to configure medical report fields.
        </p>
      </div>
    );
  }

  const isGridField = (t: string) =>
    ["text", "number", "textarea", "date", "select", "yes-no"].includes(t);
  const gridFields = fields.filter((f) => isGridField(f.fieldType));
  const fullWidthFields = fields.filter((f) => !isGridField(f.fieldType));

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="min-w-0">
          <h2 className="text-section-title text-text-main">Medical Report</h2>
          <p className="text-[12.5px] text-text-muted">
            {isReadOnly
              ? "Saved medical reports"
              : "Complete the medical report fields configured by your clinic. Each save adds a report below."}
          </p>
        </div>
        {!isReadOnly && (
          <div className="flex flex-wrap items-center justify-between sm:justify-end gap-x-3 gap-y-2 w-full sm:w-auto shrink-0">
            {lastSaved &&
              lastSaved instanceof Date &&
              !isNaN(lastSaved.getTime()) && (
                <div className="flex items-center gap-1 text-[11.5px] text-text-muted">
                  <IoCheckmarkCircleOutline className="w-3.5 h-3.5 text-health-600" />
                  Last saved: {lastSaved.toLocaleDateString()}{" "}
                  {lastSaved.toLocaleTimeString()}
                </div>
              )}
            <Button
              color="primary"
              disabled={!hasChanges || saving}
              isLoading={saving}
              size="sm"
              startContent={
                !saving ? <IoSaveOutline className="w-3.5 h-3.5" /> : undefined
              }
              onClick={handleSave}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        )}
      </div>

      {/* Grid fields */}
      {!isReadOnly && gridFields.length > 0 && (
        <div
          className={`grid grid-cols-1 ${compactLayout ? "" : "lg:grid-cols-2"} gap-4`}
        >
          {gridFields.map((f) => (
            <div key={f.id} className="min-w-0">
              {f.fieldType === "yes-no" ? (
                <FieldWrapper field={f}>{renderField(f)}</FieldWrapper>
              ) : (
                <FieldWrapper field={f}>{renderField(f)}</FieldWrapper>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Full-width fields (radio/checkbox groups) */}
      {!isReadOnly && fullWidthFields.length > 0 && (
        <div className="flex flex-col gap-4">
          {fullWidthFields.map((f) => (
            <FieldWrapper key={f.id} field={f}>
              {renderField(f)}
            </FieldWrapper>
          ))}
        </div>
      )}

      {/* Unsaved reminder */}
      {hasChanges && !isReadOnly && (
        <div className="flex items-center gap-2 px-3 py-2 bg-saffron-50 border border-saffron-200 rounded">
          <IoWarningOutline className="w-4 h-4 text-saffron-600 shrink-0" />
          <span className="text-[12px] text-saffron-700">
            Unsaved changes. Remember to save.
          </span>
        </div>
      )}

      {/* Saved reports, newest first */}
      <div className="flex flex-col gap-3 pt-2 border-t border-border-base/60">
        <h3 className="text-[13px] font-semibold text-text-main">
          Saved Reports{reports.length > 0 && ` (${reports.length})`}
        </h3>
        {reports.length === 0 ? (
          <p className="text-[12px] text-text-muted">
            No reports saved yet. Saved reports will be listed here.
          </p>
        ) : (
          reports.map((report) => (
            <SavedReportCard
              key={report.id}
              compact={compactLayout}
              fields={fields}
              report={report}
            />
          ))
        )}
      </div>
    </div>
  );
};
