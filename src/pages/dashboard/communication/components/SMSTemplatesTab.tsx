import React, { useState, useEffect } from "react";
import {
  IoSearchOutline,
  IoAddOutline,
  IoLanguageOutline,
} from "react-icons/io5";

import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@/components/ui/modal";
import { Chip } from "@/components/ui/chip";
import { addToast } from "@/components/ui/toast";
import { useAuth } from "@/hooks/useAuth";
import {
  getSMSTemplates,
  addSMSTemplate,
  updateSMSTemplate,
  deleteSMSTemplate,
  SMSTemplate,
} from "@/services/sendMessageService";

const SMSTemplatesTab: React.FC = () => {
  const { clinicId, currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState<SMSTemplate[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<SMSTemplate[]>([]);
  const [seeding, setSeeding] = useState(false);

  // Filter state
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [languageFilter, setLanguageFilter] = useState<"all" | "en" | "ne">(
    "all",
  );
  const [searchQuery, setSearchQuery] = useState("");

  // Modal state
  const [isOpen, setIsOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SMSTemplate | null>(
    null,
  );
  const [isEditing, setIsEditing] = useState(false);

  // Form state
  const [templateName, setTemplateName] = useState("");
  const [templateMessage, setTemplateMessage] = useState("");
  const [templateLanguage, setTemplateLanguage] = useState<"en" | "ne">("en");
  const [templateType, setTemplateType] = useState<
    "patient" | "doctor" | "general" | "appointment" | "reminder" | "referral"
  >("patient");

  // Multi-language preset templates
  const presetTemplates = {
    en: {
      patient: [
        {
          name: "Appointment reminder",
          message:
            "Dear {patientName}, this is a reminder for your appointment on {date} at {time} with Dr. {doctorName}. Please arrive 15 minutes early.",
        },
        {
          name: "Test results ready",
          message:
            "Dear {patientName}, your test results are ready. Please visit our clinic or call {clinicPhone} to discuss the results.",
        },
        {
          name: "Welcome message",
          message:
            "Welcome to {clinicName}! Thank you for choosing us for your healthcare needs. Call {clinicPhone} for any queries.",
        },
      ],
      appointment: [
        {
          name: "Check-in confirmation",
          message:
            "Dear {patientName}, you have checked in successfully at {clinicName} for your consultation{doctorName}. Thank you!",
        },
      ],
      doctor: [
        {
          name: "Patient arrival",
          message:
            "Dr. {doctorName}, your patient {patientName} has arrived for the {time} appointment. Room: {roomNumber}.",
        },
      ],
      general: [
        {
          name: "Clinic holiday",
          message:
            "Dear patients, {clinicName} will be closed on {date} due to {reason}. Emergency contacts: {emergencyPhone}.",
        },
      ],
    },
    ne: {
      patient: [
        {
          name: "अपोइन्टमेन्ट रिमाइन्डर",
          message:
            "नमस्ते {patientName}, डा. {doctorName} सँगको तपाईंको अपोइन्टमेन्ट {date} मा {time} बजे छ। कृपया १५ मिनेट अगावै आउनुहोला।",
        },
        {
          name: "रिपोर्ट तयार छ",
          message:
            "नमस्ते {patientName}, तपाईंको रिपोर्ट तयार भएको छ। थप जानकारीका लागि कृपया क्लिनिकमा आउनुहोस् वा {clinicPhone} मा फोन गर्नुहोस्।",
        },
        {
          name: "स्वागत सन्देश",
          message:
            "{clinicName} मा तपाईंलाई स्वागत छ! हामीलाई विश्वास गर्नुभएकोमा धन्यवाद। सहयोगको लागि {clinicPhone} मा सम्पर्क गर्नुहोस्।",
        },
      ],
      appointment: [
        {
          name: "चेक-इन पुष्टि",
          message:
            "नमस्ते {patientName}, तपाईं {clinicName} मा परामर्शको लागि सफलतापूर्वक चेक-इन हुनुभएको छ। धन्यवाद!",
        },
      ],
      doctor: [
        {
          name: "बिरामी आगमन",
          message:
            "डा. {doctorName}, तपाईंको बिरामी {patientName}, {time} बजेको अपोइन्टमेन्टको लागि आउनुभएको छ। कोठा नम्बर: {roomNumber}।",
        },
      ],
      general: [
        {
          name: "बिदाको सूचना",
          message:
            "आदरणीय बिरामीहरू, {date} का दिन {reason} ले गर्दा {clinicName} बन्द रहने जानकारी गराउँदछौं। आपतकालीन सम्पर्क: {emergencyPhone}।",
        },
      ],
    },
  };

  // Apply preset template
  const applyPreset = (preset: { name: string; message: string }) => {
    setTemplateName(preset.name);
    setTemplateMessage(preset.message);
  };

  // Load templates
  useEffect(() => {
    const loadTemplates = async () => {
      if (!clinicId) return;
      setLoading(true);
      try {
        const templatesData = await getSMSTemplates(clinicId);

        setTemplates(templatesData);
      } catch (error) {
        console.error("Error loading templates:", error);
      } finally {
        setLoading(false);
      }
    };

    loadTemplates();
  }, [clinicId]);

  // Apply filters
  useEffect(() => {
    let filtered = [...templates];

    if (searchQuery.trim()) {
      filtered = filtered.filter(
        (t) =>
          t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.message.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }
    if (typeFilter !== "all") {
      filtered = filtered.filter((t) => t.type === typeFilter);
    }
    if (languageFilter !== "all") {
      filtered = filtered.filter(
        (t) => (t.language || "en") === languageFilter,
      );
    }
    setFilteredTemplates(filtered);
  }, [templates, searchQuery, typeFilter, languageFilter]);

  // Reset form
  const resetForm = () => {
    setTemplateName("");
    setTemplateMessage("");
    setTemplateType("patient");
    setTemplateLanguage("en");
    setEditingTemplate(null);
    setIsEditing(false);
  };

  // Save template
  const handleSaveTemplate = async () => {
    if (!templateName.trim() || !templateMessage.trim()) return;
    setSaving(true);
    try {
      const templateData = {
        clinicId: clinicId!,
        name: templateName,
        message: templateMessage,
        type: templateType,
        language: templateLanguage,
        isActive: true,
        createdBy: currentUser?.uid || "system",
        updatedBy: currentUser?.uid || "system",
        updatedAt: new Date(),
        createdAt: new Date(),
      };

      if (isEditing && editingTemplate) {
        await updateSMSTemplate(
          editingTemplate.id!,
          templateData,
          currentUser?.uid || "system",
        );
        setTemplates((prev) =>
          prev.map((t) =>
            t.id === editingTemplate.id ? { ...t, ...templateData } : t,
          ),
        );
        addToast({
          title: "Success",
          description: "Template updated",
          color: "success",
        });
      } else {
        const id = await addSMSTemplate(templateData);

        setTemplates((prev) => [{ ...templateData, id }, ...prev]);
        addToast({
          title: "Success",
          description: "Template created",
          color: "success",
        });
      }
      setIsOpen(false);
      resetForm();
    } catch (error) {
      console.error("Error saving template:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-text-muted flex items-center gap-2">
            <IoLanguageOutline className="text-primary" size={14} />
            Template Directory
          </h3>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            className="clarity-btn clarity-btn-primary h-8 text-[10px] uppercase font-bold tracking-widest"
            onClick={() => setIsOpen(true)}
          >
            <IoAddOutline size={14} />
            New Template
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-surface-2 p-3 rounded border border-border-base">
        <div className="relative">
          <IoSearchOutline
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted"
            size={14}
          />
          <input
            className="clarity-input w-full pl-8 text-[11px] h-8"
            placeholder="Search templates..."
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <select
          className="clarity-input w-full text-[11px] h-8"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="all">All Categories</option>
          <option value="patient">Patient</option>
          <option value="doctor">Doctor</option>
          <option value="general">General</option>
          <option value="referral">Referral</option>
        </select>

        <select
          className="clarity-input w-full text-[11px] h-8"
          value={languageFilter}
          onChange={(e) => setLanguageFilter(e.target.value as any)}
        >
          <option value="all">All Languages</option>
          <option value="en">English (EN)</option>
          <option value="ne">Nepali (NE)</option>
        </select>

        <button
          className="text-[10px] font-bold text-text-muted uppercase tracking-widest hover:text-primary transition-colors"
          onClick={() => {
            setSearchQuery("");
            setTypeFilter("all");
            setLanguageFilter("all");
          }}
        >
          Reset Filters
        </button>
      </div>

      {/* List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTemplates.map((t) => (
          <div
            key={t.id}
            className="clarity-card p-3 border-border-base hover:border-primary/30 transition-all group"
          >
            <div className="flex justify-between items-start mb-2">
              <div className="space-y-0.5">
                <span className="text-[8px] font-black uppercase text-primary tracking-tighter bg-primary/10 px-1 rounded">
                  {t.language?.toUpperCase() || "EN"}
                </span>
                <h4 className="text-[12px] font-bold text-text-main truncate w-40">
                  {t.name}
                </h4>
              </div>
              <Chip
                className="text-[8px] h-4 font-bold uppercase"
                color="default"
                size="sm"
                variant="flat"
              >
                {t.type}
              </Chip>
            </div>
            <div className="bg-surface-2 p-2 rounded text-[11px] text-text-muted min-h-[60px] line-clamp-3 mb-3 leading-relaxed border border-border-base/50">
              {t.message}
            </div>
            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                className="flex-1 clarity-btn clarity-btn-ghost h-7 text-[9px] font-bold uppercase"
                onClick={() => {
                  setEditingTemplate(t);
                  setTemplateName(t.name);
                  setTemplateMessage(t.message);
                  setTemplateType(t.type);
                  setTemplateLanguage(t.language || "en");
                  setIsEditing(true);
                  setIsOpen(true);
                }}
              >
                Edit
              </button>
              <button
                className="flex-1 clarity-btn clarity-btn-ghost h-7 text-[9px] font-bold uppercase text-rose-500 hover:bg-rose-50 border-rose-100"
                onClick={async () => {
                  if (confirm("Delete template?")) {
                    await deleteSMSTemplate(
                      t.id!,
                      currentUser?.uid || "system",
                    );
                    setTemplates((prev) => prev.filter((x) => x.id !== t.id));
                  }
                }}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      <Modal
        isOpen={isOpen}
        onClose={() => {
          setIsOpen(false);
          resetForm();
        }}
      >
        <ModalContent>
          <ModalHeader className="text-xs font-bold uppercase tracking-widest">
            {isEditing ? "Modify Template" : "Add Template"}
          </ModalHeader>
          <ModalBody className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[9px] font-bold uppercase text-text-muted mb-1 block">
                  Language
                </label>
                <select
                  className="clarity-input w-full text-[11px] h-8"
                  value={templateLanguage}
                  onChange={(e) => setTemplateLanguage(e.target.value as any)}
                >
                  <option value="en">English (EN)</option>
                  <option value="ne">Nepali (NE)</option>
                </select>
              </div>
              <div>
                <label className="text-[9px] font-bold uppercase text-text-muted mb-1 block">
                  Category
                </label>
                <select
                  className="clarity-input w-full text-[11px] h-8"
                  value={templateType}
                  onChange={(e) => setTemplateType(e.target.value as any)}
                >
                  <option value="patient">Patient</option>
                  <option value="doctor">Doctor</option>
                  <option value="general">General</option>
                  <option value="referral">Referral</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-[9px] font-bold uppercase text-text-muted mb-1 block">
                Template Title
              </label>
              <input
                className="clarity-input w-full text-[11px] h-8"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
              />
            </div>

            {/* Presets Grid */}
            <div className="space-y-1.5">
              <span className="text-[9px] font-bold uppercase text-primary tracking-widest block">
                Available Presets
              </span>
              <div className="grid grid-cols-1 gap-1.5 max-h-32 overflow-y-auto border border-border-base p-1.5 rounded bg-surface-2/50">
                {presetTemplates[templateLanguage][
                  templateType as keyof typeof presetTemplates.en
                ]?.map((p, i) => (
                  <button
                    key={i}
                    className="text-left p-1.5 hover:bg-white rounded border border-transparent hover:border-border-base transition-all"
                    onClick={() => applyPreset(p)}
                  >
                    <span className="text-[10px] font-bold text-text-main block">
                      {p.name}
                    </span>
                    <span className="text-[9px] text-text-muted line-clamp-1">
                      {p.message}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[9px] font-bold uppercase text-text-muted mb-1 block">
                Message Content
              </label>
              <textarea
                className="clarity-textarea w-full min-h-[80px] text-[11px] leading-relaxed"
                value={templateMessage}
                onChange={(e) => setTemplateMessage(e.target.value)}
              />
              <div className="text-[9px] text-text-muted font-bold uppercase mt-1 flex justify-between">
                <span>Chars: {templateMessage.length}</span>
                <span>
                  SMS:{" "}
                  {Math.ceil(
                    templateMessage.length /
                      (templateLanguage === "ne" ? 70 : 160),
                  )}
                </span>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <button
              className="clarity-btn clarity-btn-primary w-full justify-center h-8 text-[10px] uppercase font-bold"
              onClick={handleSaveTemplate}
            >
              {saving ? "Saving..." : "Save Template"}
            </button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
};

export default SMSTemplatesTab;
