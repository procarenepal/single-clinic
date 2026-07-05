import React, { useState, useEffect } from "react";
import { RefreshCwIcon, AlertCircleIcon, CheckCircleIcon } from "lucide-react";
import { IoSearchOutline, IoCloseOutline } from "react-icons/io5";

import { addToast } from "@/components/ui/toast";
import { useAuthContext } from "@/context/AuthContext";
import { patientService } from "@/services/patientService";
import { doctorService } from "@/services/doctorService";
import { clinicService } from "@/services/clinicService";
import { referralPartnerService } from "@/services/referralPartnerService";
import { smsService, SMSTemplate } from "@/services/sendMessageService";
import { smsTestService } from "@/services/smsTestService";
import { Patient, Doctor, ReferralPartner } from "@/types/models";

function SearchSelect({
  label,
  items,
  value,
  onChange,
  disabled,
  placeholder,
}: {
  label: string;
  items: { id: string; primary: string; secondary?: string }[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const filtered = (
    q
      ? items.filter((i) => i.primary.toLowerCase().includes(q.toLowerCase()))
      : items
  ).slice(0, 100);
  const selected = items.find((i) => i.id === value);

  return (
    <div className="flex flex-col gap-1 relative">
      <label className="text-xs font-medium text-[rgb(var(--color-text-muted))]">
        {label}
      </label>
      <div
        className={`flex items-center h-9 border border-[rgb(var(--color-border))] rounded focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/10 bg-[rgb(var(--color-surface))] ${disabled ? "opacity-60 cursor-not-allowed" : "cursor-text"}`}
        onClick={() => !disabled && setOpen(true)}
      >
        <IoSearchOutline
          aria-hidden
          className="ml-2.5 w-3.5 h-3.5 text-[rgb(var(--color-text-muted))] shrink-0"
        />
        <input
          className="flex-1 text-[12.5px] px-2 bg-transparent focus:outline-none text-[rgb(var(--color-text))] placeholder:text-[rgb(var(--color-text-muted))] w-full"
          disabled={disabled}
          placeholder={placeholder || "Search…"}
          value={selected && !open ? selected.primary : q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
        {value && !disabled && (
          <button
            aria-label="Clear"
            className="mr-2 text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text))]"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
              setQ("");
            }}
          >
            <IoCloseOutline aria-hidden className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {open && !disabled && (
        <>
          <div
            aria-hidden
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded max-h-48 overflow-y-auto shadow-lg">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs text-[rgb(var(--color-text-muted))]">
                No results
              </p>
            ) : (
              filtered.map((i) => (
                <button
                  key={i.id}
                  className={`w-full text-left px-3 py-2 hover:bg-[rgb(var(--color-surface-2))] text-sm transition-colors ${i.id === value ? "bg-primary/10 text-primary" : ""}`}
                  type="button"
                  onClick={() => {
                    onChange(i.id);
                    setQ("");
                    setOpen(false);
                  }}
                >
                  <p className="text-[12.5px] text-[rgb(var(--color-text))]">
                    {i.primary}
                  </p>
                  {i.secondary && (
                    <p className="text-[11px] text-[rgb(var(--color-text-muted))]">
                      {i.secondary}
                    </p>
                  )}
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

const SendSMSTab: React.FC = () => {
  const { clinicId, currentUser } = useAuthContext();
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [referrals, setReferrals] = useState<ReferralPartner[]>([]);
  const [functionStatus, setFunctionStatus] = useState<
    "checking" | "online" | "offline"
  >("checking");

  const [templates, setTemplates] = useState<SMSTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [clinicData, setClinicData] = useState<any>(null);
  const [associatedDoctorId, setAssociatedDoctorId] = useState<string>("");

  const [selectedRecipientType, setSelectedRecipientType] = useState<
    "patient" | "doctor" | "referral"
  >("patient");
  const [selectedRecipient, setSelectedRecipient] = useState<string>("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [message, setMessage] = useState("");
  const [recipientName, setRecipientName] = useState("");

  useEffect(() => {
    checkFunctionHealth();
    loadData();
  }, [clinicId]);

  const checkFunctionHealth = async () => {
    setFunctionStatus("checking");
    try {
      const response = await smsTestService.healthCheck();

      setFunctionStatus(response.success ? "online" : "offline");
      if (!response.success) {
        addToast({
          title: "SMS Service Status",
          description: "SMS function is not available",
          color: "warning",
        });
      }
    } catch {
      setFunctionStatus("offline");
      addToast({
        title: "SMS Service Status",
        description: "Failed to connect to SMS function",
        color: "warning",
      });
    }
  };

  const loadData = async () => {
    if (!clinicId) return;
    setLoadingData(true);
    try {
      const [
        patientsData,
        doctorsData,
        referralsData,
        templatesData,
        clinicDoc,
      ] = await Promise.all([
        patientService.getPatientsByClinic(clinicId),
        doctorService.getDoctorsByClinic(clinicId),
        referralPartnerService.getReferralPartnersByClinic(clinicId),
        smsService.getSMSTemplates(clinicId),
        clinicService.getClinicById(clinicId),
      ]);

      setPatients(patientsData);
      setDoctors(doctorsData);
      setReferrals(referralsData);
      setTemplates(templatesData);
      setClinicData(clinicDoc);
    } catch (error) {
      console.error("Error loading data:", error);
      addToast({
        title: "Error",
        description: "Failed to load data. Please refresh the page.",
        color: "danger",
      });
    } finally {
      setLoadingData(false);
    }
  };

  const handleRecipientChange = (value: string) => {
    setSelectedRecipient(value);
    if (!value) {
      setPhoneNumber("");
      setRecipientName("");

      return;
    }
    if (selectedRecipientType === "patient") {
      const patient = patients.find((p) => p.id === value);

      if (patient) {
        setPhoneNumber(patient.mobile || patient.phone || "");
        setRecipientName(patient.name);

        // If a template is already selected, re-process it with the new recipient
        if (selectedTemplateId) {
          const template = templates.find((t) => t.id === selectedTemplateId);

          if (template) {
            const doctor = doctors.find((d) => d.id === associatedDoctorId);

            setMessage(
              processTemplatePlaceholders(template.message, patient, doctor),
            );
          }
        }
      }
    } else if (selectedRecipientType === "doctor") {
      const doctor = doctors.find((d) => d.id === value);

      if (doctor) {
        setPhoneNumber(doctor.phone || "");
        setRecipientName(doctor.name);

        // If a template is already selected, re-process it with the new recipient
        if (selectedTemplateId) {
          const template = templates.find((t) => t.id === selectedTemplateId);

          if (template) {
            setMessage(processTemplatePlaceholders(template.message, doctor));
          }
        }
      }
    } else if (selectedRecipientType === "referral") {
      const referral = referrals.find((r) => r.id === value);

      if (referral) {
        setPhoneNumber(referral.phone || "");
        setRecipientName(referral.name);

        // If a template is already selected, re-process it with the new recipient
        if (selectedTemplateId) {
          const template = templates.find((t) => t.id === selectedTemplateId);

          if (template) {
            setMessage(processTemplatePlaceholders(template.message, referral));
          }
        }
      }
    }
  };

  const handleAssociatedDoctorChange = (doctorId: string) => {
    setAssociatedDoctorId(doctorId);

    if (selectedTemplateId) {
      const template = templates.find((t) => t.id === selectedTemplateId);

      if (template) {
        const patient = patients.find((p) => p.id === selectedRecipient);
        const doctor = doctors.find((d) => d.id === doctorId);

        // Process with both entities
        setMessage(
          processTemplatePlaceholders(template.message, patient, doctor),
        );
      }
    }
  };

  const handleRecipientTypeChange = (value: any) => {
    setSelectedRecipientType(value);
    setSelectedRecipient("");
    setPhoneNumber("");
    setRecipientName("");
    setMessage("");
    setSelectedTemplateId("");
  };

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (!templateId) {
      setMessage("");

      return;
    }

    const template = templates.find((t) => t.id === templateId);

    if (template) {
      // Find current recipient object to process placeholders
      let recipient: any = null;
      let associatedDoctor: any = null;

      if (selectedRecipientType === "patient") {
        recipient = patients.find((p) => p.id === selectedRecipient);
        associatedDoctor = doctors.find((d) => d.id === associatedDoctorId);
      } else if (selectedRecipientType === "doctor") {
        recipient = doctors.find((d) => d.id === selectedRecipient);
      } else if (selectedRecipientType === "referral") {
        recipient = referrals.find((r) => r.id === selectedRecipient);
      }

      const processedMessage = processTemplatePlaceholders(
        template.message,
        recipient,
        associatedDoctor,
      );

      setMessage(processedMessage);
    }
  };

  const processTemplatePlaceholders = (
    text: string,
    recipient?: any,
    associatedDoctor?: any,
  ) => {
    let processed = text;

    // Clinic data from database
    processed = processed.replace(
      /{clinicName}/g,
      clinicData?.hospitalName || clinicData?.name || "Our Clinic",
    );
    processed = processed.replace(
      /{clinicPhone}/g,
      clinicData?.phone || "the clinic",
    );

    // Date/Time
    const now = new Date();

    processed = processed.replace(/{date}/g, now.toLocaleDateString());
    processed = processed.replace(
      /{time}/g,
      now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    );

    if (recipient) {
      if (selectedRecipientType === "patient") {
        processed = processed.replace(/{patientName}/g, recipient.name || "");
        processed = processed.replace(/{patientId}/g, recipient.id || "");
      } else if (selectedRecipientType === "doctor") {
        processed = processed.replace(/{doctorName}/g, recipient.name || "");
      } else if (selectedRecipientType === "referral") {
        processed = processed.replace(/{partnerName}/g, recipient.name || "");
      }
    }

    // Handle associated doctor if present (when sending to patient)
    if (associatedDoctor) {
      processed = processed.replace(
        /{doctorName}/g,
        associatedDoctor.name || "",
      );
    }

    return processed;
  };

  const handleSendSMS = async () => {
    if (!selectedRecipient || !phoneNumber || !message.trim()) {
      addToast({
        title: "Validation Error",
        description: "Please select a recipient and enter a message.",
        color: "danger",
      });

      return;
    }
    const validation = smsTestService.validatePhoneNumber(phoneNumber);

    if (!validation.isValid) {
      addToast({
        title: "Phone Number Error",
        description: validation.message || "Invalid phone number format",
        color: "danger",
      });

      return;
    }
    if (functionStatus !== "online") {
      addToast({
        title: "Service Unavailable",
        description:
          "SMS service is currently offline. Please try again later.",
        color: "danger",
      });

      return;
    }
    if (!clinicId) {
      addToast({
        title: "Error",
        description: "Clinic ID not found.",
        color: "danger",
      });

      return;
    }

    setLoading(true);
    const logData = {
      clinicId,
      message: message.trim(),
      type: "manual" as const,
      recipientType: selectedRecipientType,
      createdBy: currentUser?.uid || "system",
      status: "pending" as const,
      ...(selectedRecipientType === "patient"
        ? {
            patientId: selectedRecipient,
            patientName: recipientName,
            patientPhone: phoneNumber,
          }
        : selectedRecipientType === "doctor"
          ? {
              doctorId: selectedRecipient,
              doctorName: recipientName,
              doctorPhone: phoneNumber,
            }
          : {
              referralId: selectedRecipient,
              referralName: recipientName,
              referralPhone: phoneNumber,
            }),
    };

    try {
      const response = await smsTestService.sendTestSMS(phoneNumber, message);
      const finalLogData = {
        ...logData,
        status: (response.success ? "sent" : "failed") as "sent" | "failed",
        ...(response.success
          ? {}
          : { errorMessage: response.error || "Unknown error" }),
      };

      try {
        smsService.createSMSLog(finalLogData).catch((logError) => {
          console.error("SMS sent but failed to create log:", logError);
        });
      } catch (logError) {
        console.error("Sync log error:", logError);
      }
      if (response.success) {
        addToast({
          title: "Success",
          description: `SMS sent successfully to ${recipientName}`,
          color: "success",
        });
        setSelectedRecipient("");
        setPhoneNumber("");
        setMessage("");
        setRecipientName("");
      } else {
        addToast({
          title: "SMS Failed",
          description:
            response.error || "Failed to send SMS. Please try again.",
          color: "danger",
        });
      }
    } catch (error) {
      try {
        smsService
          .createSMSLog({
            ...logData,
            status: "failed" as const,
            errorMessage:
              error instanceof Error ? error.message : "Unknown error",
          })
          .catch(console.error);
      } catch {
        console.error("Failed to create SMS log");
      }
      addToast({
        title: "Error",
        description: "Failed to send SMS. Please try again.",
        color: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) {
    return (
      <div className="flex justify-center items-center py-12 text-[rgb(var(--color-text-muted))]">
        Loading...
      </div>
    );
  }

  const availablePatients = patients.filter((p) => p.mobile || p.phone);
  const availableDoctors = doctors.filter((d) => d.phone);
  const availableReferrals = referrals.filter((r) => r.phone);

  const recipientSearchItems =
    selectedRecipientType === "patient"
      ? availablePatients.map((p) => ({
          id: p.id,
          primary: p.name,
          secondary: p.mobile || p.phone || "No phone",
        }))
      : selectedRecipientType === "doctor"
        ? availableDoctors.map((d) => ({
            id: d.id,
            primary: d.name,
            secondary:
              `${d.phone || ""}${d.speciality ? ` • ${d.speciality}` : ""}`.trim() ||
              undefined,
          }))
        : availableReferrals.map((r) => ({
            id: r.id,
            primary: r.name,
            secondary: r.phone || "No phone",
          }));

  return (
    <div className="space-y-4">
      {/* SMS Service Status */}
      <div className="clarity-card p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-3 h-3 rounded-full ${
                functionStatus === "online"
                  ? "bg-health-500"
                  : functionStatus === "offline"
                    ? "bg-rose-500"
                    : "bg-saffron-500"
              }`}
            />
            <div className="flex items-center gap-2">
              {functionStatus === "online" ? (
                <CheckCircleIcon
                  aria-hidden
                  className="text-health-600"
                  size={16}
                />
              ) : functionStatus === "offline" ? (
                <AlertCircleIcon
                  aria-hidden
                  className="text-rose-600"
                  size={16}
                />
              ) : (
                <span className="text-xs text-[rgb(var(--color-text-muted))]">
                  Checking...
                </span>
              )}
              <span className="text-sm font-medium text-[rgb(var(--color-text))]">
                SMS Service:{" "}
                {functionStatus === "online"
                  ? "Online"
                  : functionStatus === "offline"
                    ? "Offline"
                    : "Checking..."}
              </span>
            </div>
          </div>
          <button
            aria-label="Refresh status"
            className="clarity-btn clarity-btn-ghost h-8 w-8 p-0 justify-center"
            disabled={functionStatus === "checking"}
            type="button"
            onClick={checkFunctionHealth}
          >
            <RefreshCwIcon aria-hidden size={16} />
          </button>
        </div>
        {functionStatus === "online" && (
          <p className="text-xs text-[rgb(var(--color-text-muted))] mt-1">
            Direct SMS sending is available for instant delivery
          </p>
        )}
      </div>

      {/* Recipient Type & Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-[rgb(var(--color-text-muted))] mb-1">
            Recipient Type
          </label>
          <select
            aria-label="Recipient type"
            className="clarity-input w-full"
            value={selectedRecipientType}
            onChange={(e) => handleRecipientTypeChange(e.target.value)}
          >
            <option value="patient">
              Patients ({availablePatients.length} available)
            </option>
            <option value="doctor">
              Doctors ({availableDoctors.length} available)
            </option>
            <option value="referral">
              Referral Partners ({availableReferrals.length} available)
            </option>
          </select>
        </div>

        <SearchSelect
          disabled={!selectedRecipientType}
          items={recipientSearchItems}
          label={
            selectedRecipientType === "patient"
              ? "Select Patient"
              : selectedRecipientType === "doctor"
                ? "Select Doctor"
                : "Select Partner"
          }
          placeholder={
            selectedRecipientType === "patient"
              ? "Search patients…"
              : selectedRecipientType === "doctor"
                ? "Search doctors…"
                : "Search partners…"
          }
          value={selectedRecipient}
          onChange={handleRecipientChange}
        />

        {selectedRecipientType === "patient" && (
          <div>
            <label className="block text-xs font-medium text-[rgb(var(--color-text-muted))] mb-1">
              Related Doctor (Optional)
            </label>
            <select
              className="clarity-input w-full"
              value={associatedDoctorId}
              onChange={(e) => handleAssociatedDoctorChange(e.target.value)}
            >
              <option value="">No doctor mentioned</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-[rgb(var(--color-text-muted))] mt-1">
              Fills the {"{doctorName}"} placeholder in your message
            </p>
          </div>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-[rgb(var(--color-text-muted))] mb-1">
          Quick templates
        </label>
        <select
          aria-label="Select template"
          className="clarity-input w-full"
          value={selectedTemplateId}
          onChange={(e) => handleTemplateChange(e.target.value)}
        >
          <option value="">Custom message (no template)</option>
          {templates
            .filter(
              (t) => t.type === selectedRecipientType || t.type === "general",
            )
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
        </select>
        <p className="text-[11px] text-[rgb(var(--color-text-muted))] mt-1">
          Select a template to auto-populate the message field
        </p>
      </div>

      {phoneNumber && (
        <div>
          <label className="block text-xs font-medium text-[rgb(var(--color-text-muted))] mb-1">
            Phone Number
          </label>
          <input
            aria-label="Phone number"
            className="clarity-input w-full"
            placeholder="Phone number"
            type="text"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
          />
          <p className="text-xs text-[rgb(var(--color-text-muted))] mt-0.5">
            Phone number will be validated before sending
          </p>
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-[rgb(var(--color-text-muted))] mb-1">
          Message
        </label>
        <textarea
          aria-label="Message"
          className="clarity-textarea w-full min-h-[120px]"
          placeholder="Type your message here..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <div className="flex justify-between items-center text-sm text-[rgb(var(--color-text-muted))] mt-1">
          <span>Character count: {message.length}</span>
          <span>SMS count: {Math.ceil(message.length / 160)}</span>
        </div>
      </div>

      {recipientName && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-[rgb(var(--color-text-muted))]">
            Sending to:
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20">
            {recipientName} ({phoneNumber})
          </span>
        </div>
      )}

      <div className="flex justify-end">
        <button
          className="clarity-btn clarity-btn-primary min-w-[120px]"
          disabled={
            !selectedRecipient ||
            !phoneNumber ||
            !message.trim() ||
            functionStatus !== "online" ||
            loading
          }
          type="button"
          onClick={handleSendSMS}
        >
          {loading ? "Sending…" : "Send SMS"}
        </button>
      </div>

      <div className="clarity-card p-3 bg-[rgb(var(--color-surface-2))]">
        <p className="text-sm font-medium text-[rgb(var(--color-text))] mb-1">
          Quick SMS Tips
        </p>
        <ul className="text-xs space-y-1 text-[rgb(var(--color-text-muted))]">
          <li>• Phone numbers are automatically validated</li>
          <li>• SMS is sent instantly using direct service</li>
          <li>
            • Messages over 160 characters will be split into multiple SMS
          </li>
          <li>
            • All SMS activity is logged and can be viewed in SMS Logs tab
          </li>
        </ul>
      </div>
    </div>
  );
};

export default SendSMSTab;
