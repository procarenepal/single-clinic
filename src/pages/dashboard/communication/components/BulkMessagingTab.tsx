import React, { useState, useEffect, useMemo } from "react";
import {
  Users,
  Filter,
  Send,
  AlertCircle,
  Info,
  Sparkles,
  Search,
  Trash2,
  Check,
  UserCheck,
} from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { patientService } from "@/services/patientService";
import { doctorService } from "@/services/doctorService";
import { appointmentService } from "@/services/appointmentService";
import { smsService, SMSTemplate } from "@/services/sendMessageService";
import { smsTestService } from "@/services/smsTestService";
import { clinicService } from "@/services/clinicService";
import { addToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";
import { Patient, Doctor, Appointment } from "@/types/models";

const BulkMessagingTab: React.FC = () => {
  const { clinicId, currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  // Data
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [templates, setTemplates] = useState<SMSTemplate[]>([]);
  const [clinicData, setClinicData] = useState<any>(null);

  // Filters
  const [audienceType, setAudienceType] = useState<
    "all" | "recent" | "upcoming" | "custom" | "manual"
  >("all");
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>(
    new Date().toISOString().split("T")[0],
  );
  const [endDate, setEndDate] = useState<string>(
    new Date().toISOString().split("T")[0],
  );

  // Manual Selection State
  const [manualRecipientIds, setManualRecipientIds] = useState<Set<string>>(
    new Set(),
  );
  const [patientSearchQuery, setPatientSearchQuery] = useState("");

  // Message
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const loadAllData = async () => {
      if (!clinicId) return;
      setLoading(true);
      try {
        const [p, d, t, c, a] = await Promise.all([
          patientService.getPatientsByClinic(clinicId),
          doctorService.getDoctorsByClinic(clinicId),
          smsService.getSMSTemplates(clinicId),
          clinicService.getClinicById(clinicId),
          appointmentService.getAppointmentsByClinic(clinicId),
        ]);

        setPatients(p || []);
        setDoctors(d || []);
        setTemplates(t || []);
        setClinicData(c);
        setAppointments(a || []);
      } catch (error) {
        console.error("Error loading bulk data:", error);
        addToast({
          title: "Error",
          description: "Failed to load clinic data",
          color: "danger",
        });
      } finally {
        setLoading(false);
      }
    };

    loadAllData();
  }, [clinicId]);

  // Filtering Logic
  const targetedPatients = useMemo(() => {
    if (audienceType === "manual") {
      return patients.filter((p) => manualRecipientIds.has(p.id));
    }

    let result: Patient[] = [];

    if (audienceType === "all") {
      result = patients;
    } else {
      let filteredApps = [...appointments];
      const today = new Date();

      today.setHours(0, 0, 0, 0);

      if (audienceType === "recent") {
        const thirtyDaysAgo = new Date();

        thirtyDaysAgo.setDate(today.getDate() - 30);
        filteredApps = appointments.filter((a) => {
          const d = new Date(a.appointmentDate);

          return d >= thirtyDaysAgo && d <= new Date();
        });
      } else if (audienceType === "upcoming") {
        const sevenDaysAhead = new Date();

        sevenDaysAhead.setDate(today.getDate() + 7);
        filteredApps = appointments.filter((a) => {
          const d = new Date(a.appointmentDate);

          return d >= today && d <= sevenDaysAhead;
        });
      } else if (audienceType === "custom") {
        const start = new Date(startDate);
        const end = new Date(endDate);

        end.setHours(23, 59, 59);
        filteredApps = appointments.filter((a) => {
          const d = new Date(a.appointmentDate);

          return d >= start && d <= end;
        });
      }

      if (selectedDoctorId !== "all") {
        filteredApps = filteredApps.filter(
          (a) => a.doctorId === selectedDoctorId,
        );
      }

      const matchedPatientIds = new Set(filteredApps.map((a) => a.patientId));

      result = patients.filter((p) => matchedPatientIds.has(p.id));
    }

    return result.filter((p) => p.mobile || p.phone);
  }, [
    audienceType,
    patients,
    appointments,
    selectedDoctorId,
    startDate,
    endDate,
    manualRecipientIds,
  ]);

  // Patient List for Browser (filtered by search query if any)
  const browserPatients = useMemo(() => {
    const query = patientSearchQuery.toLowerCase().trim();
    const baseList = patients.filter((p) => p.mobile || p.phone);

    if (!query) return baseList;

    return baseList.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.regNumber.toLowerCase().includes(query),
    );
  }, [patientSearchQuery, patients]);

  const toggleManualRecipient = (patientId: string) => {
    setManualRecipientIds((prev) => {
      const next = new Set(prev);

      if (next.has(patientId)) next.delete(patientId);
      else next.add(patientId);

      return next;
    });
  };

  const clearManualSelection = () => setManualRecipientIds(new Set());

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (!templateId) {
      setMessage("");

      return;
    }
    const template = templates.find((t) => t.id === templateId);

    if (template) {
      let processed = template.message;

      processed = processed.replace(
        /{clinicName}/g,
        clinicData?.hospitalName || clinicData?.name || "Our Clinic",
      );
      processed = processed.replace(
        /{clinicPhone}/g,
        clinicData?.phone || "the clinic",
      );
      setMessage(processed);
    }
  };

  const handleSendBulk = async () => {
    if (targetedPatients.length === 0) return;
    if (!message.trim()) {
      addToast({
        title: "Validation Error",
        description: "Please enter a message",
        color: "danger",
      });

      return;
    }

    const confirmSend = window.confirm(
      `Confirm Campaign:\n- Recipients: ${targetedPatients.length}\n- Est. Cost: Rs. ${(targetedPatients.length * 1.5).toFixed(2)}\n\nProceed?`,
    );

    if (!confirmSend) return;

    setSending(true);
    setProgress({ current: 0, total: targetedPatients.length });

    let successCount = 0;
    let failCount = 0;

    for (const patient of targetedPatients) {
      try {
        let patientMessage = message;

        patientMessage = patientMessage.replace(/{patientName}/g, patient.name);

        const phone = patient.mobile || patient.phone || "";

        if (!phone) continue;

        const response = await smsTestService.sendTestSMS(
          phone,
          patientMessage,
        );

        await smsService.createSMSLog({
          clinicId: clinicId!,
          message: patientMessage,
          type: "manual",
          recipientType: "patient",
          patientId: patient.id,
          patientName: patient.name,
          patientPhone: phone,
          createdBy: currentUser?.uid || "system",
          status: response.success ? "sent" : "failed",
          ...(response.success
            ? {}
            : { errorMessage: response.error || "Delivery failure" }),
        });

        if (response.success) successCount++;
        else failCount++;
      } catch (error) {
        console.error(`Failed to send to ${patient.name}:`, error);
        failCount++;
      }
      setProgress((prev) => ({ ...prev, current: prev.current + 1 }));
    }

    setSending(false);
    addToast({
      title: "Campaign Finished",
      description: `Sent: ${successCount} | Failed: ${failCount}`,
      color: successCount > 0 ? "success" : "danger",
    });
  };

  if (loading)
    return (
      <div className="flex justify-center py-12 bg-surface-base">
        <Spinner size="lg" />
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Step 1: Define Audience */}
        <div className="lg:col-span-1 space-y-4">
          <div className="clarity-card p-4">
            <h3 className="text-xs font-bold uppercase tracking-tight mb-4 flex items-center gap-2 text-text-main">
              <Users className="text-primary" size={14} />
              1. Select Recipients
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase mb-1.5 tracking-wide">
                  Campaign Target
                </label>
                <select
                  className="clarity-input w-full text-xs"
                  value={audienceType}
                  onChange={(e) => setAudienceType(e.target.value as any)}
                >
                  <option value="all">All Registered Patients</option>
                  <option value="recent">Recent Visitors (30 Days)</option>
                  <option value="upcoming">Upcoming Visits (7 Days)</option>
                  <option value="custom">Custom Date Range</option>
                  <option value="manual">Browse & Select Patients</option>
                </select>
              </div>

              {/* Manual Patient Browser UI */}
              {audienceType === "manual" && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-text-muted uppercase tracking-wide">
                      Patient Directory
                    </label>
                    <button
                      className="text-[9px] font-bold uppercase text-rose-500 hover:underline flex items-center gap-1"
                      onClick={clearManualSelection}
                    >
                      <Trash2 size={10} />
                      Clear All
                    </button>
                  </div>

                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                      <Search size={13} />
                    </div>
                    <input
                      className="clarity-input w-full pl-9 text-[11px]"
                      placeholder="Quick find by name..."
                      type="text"
                      value={patientSearchQuery}
                      onChange={(e) => setPatientSearchQuery(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1 max-h-[250px] overflow-y-auto pr-1 border border-border-base rounded bg-surface-2 p-1 custom-scrollbar">
                    {browserPatients.length === 0 ? (
                      <p className="text-[10px] text-text-muted italic py-8 text-center">
                        No patients match your search
                      </p>
                    ) : (
                      browserPatients.map((p) => {
                        const isSelected = manualRecipientIds.has(p.id);

                        return (
                          <div
                            key={p.id}
                            className={`flex justify-between items-center px-3 py-2 rounded cursor-pointer transition-all border ${
                              isSelected
                                ? "bg-primary/10 border-primary/40"
                                : "bg-surface-1 border-border-base hover:border-primary/30"
                            }`}
                            onClick={() => toggleManualRecipient(p.id)}
                          >
                            <div className="flex flex-col">
                              <span
                                className={`text-[11px] font-bold ${isSelected ? "text-primary" : "text-text-main"}`}
                              >
                                {p.name}
                              </span>
                              <span className="text-[9px] text-text-muted uppercase font-bold tracking-tighter">
                                ID: {p.regNumber} • {p.mobile || p.phone}
                              </span>
                            </div>
                            <div
                              className={`w-4 h-4 rounded-full flex items-center justify-center border transition-all ${
                                isSelected
                                  ? "bg-primary border-primary text-white"
                                  : "bg-transparent border-border-base text-transparent"
                              }`}
                            >
                              <Check size={10} />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {audienceType === "custom" && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-text-muted uppercase mb-1.5 tracking-wide">
                      Start Date
                    </label>
                    <input
                      className="clarity-input w-full text-xs"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-text-muted uppercase mb-1.5 tracking-wide">
                      End Date
                    </label>
                    <input
                      className="clarity-input w-full text-xs"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {audienceType !== "all" && audienceType !== "manual" && (
                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase mb-1.5 tracking-wide">
                    Filter by Doctor
                  </label>
                  <select
                    className="clarity-input w-full text-xs"
                    value={selectedDoctorId}
                    onChange={(e) => setSelectedDoctorId(e.target.value)}
                  >
                    <option value="all">Any Doctor</option>
                    {doctors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="pt-4 border-t border-border-base bg-surface-2 -mx-4 px-4 pb-0">
                <div className="flex justify-between items-center text-xs py-2">
                  <span className="text-text-muted font-medium">
                    Total Recipients:
                  </span>
                  <span className="font-bold text-primary">
                    {targetedPatients.length}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs py-2 border-t border-border-base/50">
                  <span className="text-text-muted font-medium">
                    Estimated Cost:
                  </span>
                  <span className="font-bold text-text-main">
                    Rs. {(targetedPatients.length * 1.5).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-surface-2 rounded-md border border-border-base text-text-main shadow-sm">
            <h4 className="text-[10px] font-bold uppercase mb-2 flex items-center gap-1.5 text-primary">
              <Info size={14} />
              Important Notice
            </h4>
            <p className="text-[10px] leading-relaxed text-text-muted font-medium">
              Bulk messages are sent sequentially. Do not navigate away while
              the campaign is in progress.
            </p>
          </div>
        </div>

        {/* Step 2: Compose Message */}
        <div className="lg:col-span-2 space-y-4">
          <div className="clarity-card p-4">
            <h3 className="text-xs font-bold uppercase tracking-tight mb-4 flex items-center gap-2 text-text-main">
              <Filter className="text-primary" size={14} />
              2. Compose Campaign
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase mb-1.5 tracking-wide">
                  Use Template
                </label>
                <select
                  className="clarity-input w-full text-xs"
                  value={selectedTemplateId}
                  onChange={(e) => handleTemplateChange(e.target.value)}
                >
                  <option value="">Custom Message (No Template)</option>
                  {templates
                    .filter((t) => t.type === "general" || t.type === "patient")
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase mb-1.5 tracking-wide">
                  Message Content
                </label>
                <textarea
                  className="clarity-textarea w-full min-h-[160px] text-xs leading-relaxed"
                  placeholder="Enter your announcement here..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
                <div className="flex justify-between items-center text-[10px] text-text-muted mt-1.5 font-medium uppercase">
                  <span>Characters: {message.length}</span>
                  <span>Segments: {Math.ceil(message.length / 160)}</span>
                </div>
              </div>

              {sending ? (
                <div className="space-y-3 pt-4 border-t border-border-base">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-primary flex items-center gap-2 uppercase tracking-tight">
                      <Sparkles className="animate-spin" size={12} />
                      Executing Campaign...
                    </span>
                    <span className="font-mono text-[10px] font-bold text-text-main">
                      {progress.current} / {progress.total}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-surface-2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{
                        width: `${(progress.current / progress.total) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className="pt-4 border-t border-border-base flex justify-end items-center gap-4">
                  <div className="flex-1">
                    {targetedPatients.length === 0 && (
                      <p className="text-rose-600 text-[10px] font-bold uppercase flex items-center gap-1">
                        <AlertCircle size={12} />
                        No eligible recipients.
                      </p>
                    )}
                  </div>
                  <button
                    className="clarity-btn clarity-btn-primary min-w-[200px] justify-center text-xs uppercase font-bold tracking-tight py-2.5"
                    disabled={
                      targetedPatients.length === 0 ||
                      !message.trim() ||
                      sending
                    }
                    type="button"
                    onClick={handleSendBulk}
                  >
                    <Send size={14} />
                    Launch Campaign
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Campaign Preview */}
          {message.trim() && targetedPatients.length > 0 && (
            <div className="clarity-card p-4 border-dashed border-primary/20 bg-surface-3">
              <h4 className="text-[10px] font-bold uppercase mb-3 text-text-muted flex items-center gap-1.5 tracking-wide">
                <UserCheck className="text-green-600" size={14} />
                Live Preview ({targetedPatients[0].name})
              </h4>
              <div className="bg-surface-2 p-4 rounded border border-border-base text-xs leading-relaxed shadow-sm text-text-main">
                {message.replace(/{patientName}/g, targetedPatients[0].name)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BulkMessagingTab;
