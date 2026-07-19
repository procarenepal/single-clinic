import React, { useState, useEffect, useRef } from "react";
import ReactQuill from "react-quill";
import {
  IoSaveOutline,
  IoPrintOutline,
  IoDocumentTextOutline,
  IoAddOutline,
  IoCloseOutline,
  IoEyeOutline,
  IoChevronDownOutline,
} from "react-icons/io5";

import { addToast } from "@/components/ui/toast";
import { PrintLayout } from "@/components/PrintLayout";
import { TextDocument } from "@/types/textEditor";
import { textEditorService } from "@/services/textEditorService";
import { clinicService } from "@/services/clinicService";
import { useAuthContext } from "@/context/AuthContext";
import "react-quill/dist/quill.snow.css";
import "@/styles/quill-custom.css";

/** Local wrapper for clarity-card (avoids ReferenceError if any cached/bundled code still expected HeroUI Card) */
const Card = ({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) => <div className={`clarity-card ${className}`.trim()}>{children}</div>;

interface TextEditorComponentProps {
  document?: TextDocument;
  onSave: (document: TextDocument) => void;
  onCancel: () => void;
  clinicId: string;
  branchId?: string;
}

export const TextEditorComponent: React.FC<TextEditorComponentProps> = ({
  document,
  onSave,
  onCancel,
  clinicId,
  branchId,
}) => {
  const { currentUser, userData } = useAuthContext();
  const [title, setTitle] = useState(document?.title || "");
  const [content, setContent] = useState(document?.content || "");
  const [tags, setTags] = useState<string[]>(document?.tags || []);
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [layoutConfig, setLayoutConfig] = useState<any>(null);
  const [clinic, setClinic] = useState<any>(null);
  const [templateDropdownOpen, setTemplateDropdownOpen] = useState(false);

  const quillRef = useRef<any>(null);
  const templateDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const doc = typeof window !== "undefined" ? window.document : null;

    if (!doc) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        templateDropdownRef.current &&
        !templateDropdownRef.current.contains(e.target as Node)
      ) {
        setTemplateDropdownOpen(false);
      }
    }
    doc.addEventListener("mousedown", handleClickOutside);

    return () => doc.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Quill modules configuration
  const quillModules = {
    toolbar: [
      [{ header: [1, 2, 3, false] }],
      ["bold", "italic", "underline", "strike"],
      [{ list: "ordered" }, { list: "bullet" }],
      [{ indent: "-1" }, { indent: "+1" }],
      [{ align: [] }],
      ["link"],
      ["clean"],
    ],
  };

  const quillFormats = [
    "header",
    "bold",
    "italic",
    "underline",
    "strike",
    "list",
    "bullet",
    "indent",
    "align",
    "link",
  ];

  // Template insertion functions for Quill
  const insertTemplate = (template: string) => {
    if (quillRef.current) {
      const quill = quillRef.current.getEditor();
      const range = quill.getSelection();
      const index = range ? range.index : quill.getLength();

      quill.insertText(index, template);
      quill.setSelection(index + template.length);
    }
  };

  // Load clinic and layout data
  useEffect(() => {
    const loadClinicData = async () => {
      try {
        // Load clinic and layout configuration
        const [clinicData, layoutConfigData] = await Promise.all([
          clinicService.getClinicById(clinicId),
          clinicService.getPrintLayoutConfig(clinicId),
        ]);

        if (clinicData) {
          setClinic(clinicData);
        }

        if (layoutConfigData) {
          setLayoutConfig(layoutConfigData);
        }
      } catch (error) {
        console.error("Error loading clinic data:", error);
        // Set fallback data if loading fails
        setClinic({
          name: "Medical Clinic",
          address: "",
          city: "",
          phone: "",
          email: "",
        });
        setLayoutConfig({
          primaryColor: "#2563eb",
          clinicName: "Medical Clinic",
          logoUrl: "",
          tagline: "",
          address: "",
          city: "",
          state: "",
          zipCode: "",
          phone: "",
          email: "",
          website: "",
          footerText: "",
        });
      }
    };

    if (clinicId) {
      loadClinicData();
    }
  }, [clinicId]); // Auto-save functionality (every 30 seconds if there are changes)
  useEffect(() => {
    if (!document || !currentUser) return;

    const hasChanges =
      title !== document.title ||
      content !== document.content ||
      JSON.stringify(tags) !== JSON.stringify(document.tags || []);

    if (!hasChanges) return;

    const autoSaveTimer = setTimeout(() => {
      handleSave(false); // Silent save
    }, 30000);

    return () => clearTimeout(autoSaveTimer);
  }, [title, content, tags, document, currentUser]);

  const handleSave = async (showToast = true) => {
    if (!currentUser) return;
    if (!title.trim()) {
      addToast({
        title: "Error",
        description: "Please enter a title for the document",
        color: "danger",
      });

      return;
    }

    try {
      setSaving(true);

      let savedDocument: TextDocument;

      if (document) {
        // Update existing document
        await textEditorService.updateDocument(document.id, {
          title: title.trim(),
          content: content.trim(),
          tags: tags.filter((tag) => tag.trim()),
          lastModifiedBy: currentUser.uid,
        });

        savedDocument = {
          ...document,
          title: title.trim(),
          content: content.trim(),
          tags: tags.filter((tag) => tag.trim()),
          updatedAt: new Date(),
          lastModifiedBy: currentUser.uid,
        };
      } else {
        // Create new document
        const documentId = await textEditorService.createDocument({
          title: title.trim(),
          content: content.trim(),
          clinicId,
          branchId,
          createdBy: currentUser.uid,
          tags: tags.filter((tag) => tag.trim()),
        });

        savedDocument = {
          id: documentId,
          title: title.trim(),
          content: content.trim(),
          clinicId,
          branchId,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: currentUser.uid,
          lastModifiedBy: currentUser.uid,
          tags: tags.filter((tag) => tag.trim()),
        };
      }

      if (showToast) {
        addToast({
          title: "Success",
          description: `Document ${document ? "updated" : "created"} successfully`,
          color: "success",
        });
      }

      onSave(savedDocument);
    } catch (error) {
      console.error("Error saving document:", error);
      addToast({
        title: "Error",
        description: "Failed to save document. Please try again.",
        color: "danger",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAddTag = () => {
    const newTag = tagInput.trim();

    if (newTag && !tags.includes(newTag)) {
      setTags([...tags, newTag]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handlePrint = async () => {
    if (!title.trim() || !content.trim()) {
      addToast({
        title: "Error",
        description: "Please enter title and content before printing.",
        color: "danger",
      });

      return;
    }

    try {
      const printContent = generatePrintContent({
        title,
        content,
        tags,
        clinic,
        layoutConfig,
        document,
        currentUser,
        userData,
      });

      // Create and open print window
      const printWindow = window.open("", "_blank");

      if (!printWindow) {
        addToast({
          title: "Error",
          description: "Popup blocked. Please allow popups for this site.",
          color: "danger",
        });

        return;
      }

      printWindow.document.write(printContent);
      printWindow.document.close();

      // Handle print completion
      const handlePrintComplete = () => {
        printWindow.close();
      };

      printWindow.addEventListener("afterprint", handlePrintComplete);
      printWindow.addEventListener("beforeunload", handlePrintComplete);

      // Auto-trigger print after content loads
      printWindow.addEventListener("load", () => {
        setTimeout(() => {
          printWindow.print();
        }, 500);
      });
    } catch (error) {
      console.error("Error generating print:", error);
      addToast({
        title: "Error",
        description: "Failed to generate print. Please try again.",
        color: "danger",
      });
    }
  };

  const generatePrintContent = (data: any) => {
    const {
      title,
      content,
      tags = [],
      clinic = {},
      layoutConfig = {},
      document,
      currentUser,
      userData,
    } = data;

    const rawClinicName = clinic?.name || layoutConfig?.clinicName || "Medical Clinic";
    const formattedClinicName = rawClinicName.replace(/\s+(Pvt\.?\s*Ltd\.?)/i, "<br/>$1");

    // Format date
    const formatDateTime = (date: Date) => {
      return new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }).format(date);
    };

    // Convert HTML content to printable format
    const formatContentForPrint = (htmlContent: string) => {
      // Simple HTML content processing for print
      return htmlContent
        .replace(/<p><br><\/p>/g, "<br>")
        .replace(/<p>/g, '<p style="margin: 8px 0;">')
        .replace(
          /<h1>/g,
          '<h1 style="font-size: 24px; font-weight: bold; margin: 16px 0 8px 0; color: #1f2937;">',
        )
        .replace(
          /<h2>/g,
          '<h2 style="font-size: 20px; font-weight: bold; margin: 14px 0 6px 0; color: #374151;">',
        )
        .replace(
          /<h3>/g,
          '<h3 style="font-size: 18px; font-weight: bold; margin: 12px 0 4px 0; color: #4b5563;">',
        )
        .replace(/<ul>/g, '<ul style="margin: 8px 0; padding-left: 24px;">')
        .replace(/<ol>/g, '<ol style="margin: 8px 0; padding-left: 24px;">')
        .replace(/<li>/g, '<li style="margin: 4px 0;">')
        .replace(/<strong>/g, '<strong style="font-weight: 600;">')
        .replace(/<em>/g, '<em style="font-style: italic;">')
        .replace(/<u>/g, '<span style="text-decoration: underline;">')
        .replace(/<\/u>/g, "</span>");
    };

    return `<!DOCTYPE html>
<html>
<head>
  <title>Document - ${title}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 0;
      background: white;
      color: #333;
    }
    .print-container {
      max-width: 100%;
      margin: 0;
      background: white;
      display: flex;
      flex-direction: column;
      height: 100vh;
      padding: 10mm;
      box-sizing: border-box;
    }
    .header {
      border-bottom: 2px solid #333;
      padding-bottom: ${
        layoutConfig?.headerHeight === "compact"
          ? "10px"
          : layoutConfig?.headerHeight === "expanded"
            ? "20px"
            : "15px"
      };
      margin-bottom: ${
        layoutConfig?.headerHeight === "compact"
          ? "10px"
          : layoutConfig?.headerHeight === "expanded"
            ? "20px"
            : "15px"
      };
    }
    .header-content {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 20px;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 20px;
      ${
        layoutConfig?.logoPosition === "center"
          ? "justify-content: center; text-align: center;"
          : layoutConfig?.logoPosition === "right"
            ? "justify-content: flex-end; text-align: right;"
            : "justify-content: flex-start; text-align: left;"
      }
    }
    .header-right {
      text-align: right;
      font-size: ${
        layoutConfig?.fontSize === "small"
          ? "11px"
          : layoutConfig?.fontSize === "large"
            ? "14px"
            : "12px"
      };
      color: #333;
      line-height: 1.4;
    }
    .logo {
      ${
        layoutConfig?.logoSize === "small"
          ? "height: 40px;"
          : layoutConfig?.logoSize === "large"
            ? "height: 80px;"
            : "height: 60px;"
      }
      width: auto;
      object-fit: contain;
    }
    .clinic-info {
      ${layoutConfig?.logoPosition === "center" ? "text-align: center;" : ""}
    }
    .clinic-name {
      font-weight: bold;
      color: ${layoutConfig?.primaryColor || "#2563eb"};
      margin: 0;
      font-size: ${
        layoutConfig?.fontSize === "small"
          ? "20px"
          : layoutConfig?.fontSize === "large"
            ? "30px"
            : "26px"
      };
    }
    .tagline {
      font-size: ${
        layoutConfig?.fontSize === "small"
          ? "12px"
          : layoutConfig?.fontSize === "large"
            ? "16px"
            : "14px"
      };
      color: #666;
      margin: 5px 0;
    }
    .clinic-details {
      margin-top: 10px;
      color: #333;
      font-size: ${
        layoutConfig?.fontSize === "small"
          ? "11px"
          : layoutConfig?.fontSize === "large"
            ? "14px"
            : "12px"
      };
    }
    .document-title {
      text-align: center;
      margin: 20px 0;
    }
    .document-title h2 {
      font-size: 18px;
      font-weight: 600;
      margin: 0;
      text-transform: uppercase;
    }
    .document-subtitle {
      font-size: 14px;
      color: #666;
      margin: 5px 0;
    }
    .document-info {
      display: flex;
      justify-content: space-between;
      margin-top: 10px;
      font-size: 14px;
      color: #666;
    }
    .date-info {
      text-align: right;
    }
    .date-bs {
      font-size: 12px;
      color: #888;
      font-style: italic;
    }
    .content {
      flex: 1;
      padding: 10px 0;
      min-height: 0;
    }
    
    /* Document Content */
    .document-content {
      margin: 20px 0;
      padding: 15px;
      background: #fafafa;
      border-radius: 5px;
      font-size: 14px;
      line-height: 1.6;
    }
    
    /* Tags */
    .tags-section {
      margin: 15px 0;
      padding: 12px;
      background: #f8fafc;
      border-left: 4px solid ${layoutConfig?.primaryColor || "#2563eb"};
      border-radius: 3px;
    }
    .tags-section h3 {
      margin: 0 0 8px 0;
      font-size: 14px;
      color: #374151;
    }
    .tag {
      display: inline-block;
      background: ${layoutConfig?.primaryColor || "#2563eb"};
      color: white;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 11px;
      margin: 0 6px 6px 0;
      font-weight: 500;
    }
    
    .footer {
      border-top: 1px solid #333;
      padding-top: 10px;
      margin-top: auto;
      text-align: center;
      font-size: ${
        layoutConfig?.fontSize === "small"
          ? "11px"
          : layoutConfig?.fontSize === "large"
            ? "13px"
            : "12px"
      };
      color: #666;
      flex-shrink: 0;
    }
    
    @media print {
      body { 
        padding: 0; 
        margin: 0; 
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }
      .print-container {
        height: 100vh;
        padding: 5mm;
        max-width: 100%;
        box-sizing: border-box;
      }
      .document-content {
        background: white !important;
      }
      .tags-section {
        background: white !important;
        border: 1px solid #ddd !important;
      }
    }
  </style>
</head>
<body>
  <div class="print-container">
    <!-- Header -->
    <div class="header">
      <div class="header-content">
        <div class="header-left">
          ${layoutConfig?.logoUrl ? `<img src="${layoutConfig.logoUrl}" alt="Logo" class="logo" />` : ""}
          <div class="clinic-info">
            <h1 class="clinic-name">${formattedClinicName}</h1>
            ${layoutConfig?.tagline ? `<p class="tagline">${layoutConfig.tagline}</p>` : ""}
            <div class="clinic-details">
              <p>${layoutConfig?.address || clinic?.address || ""}</p>
              <p>${layoutConfig?.city || clinic?.city || ""}${layoutConfig?.state ? `, ${layoutConfig.state}` : ""} ${layoutConfig?.zipCode || ""}</p>
              ${layoutConfig?.website ? `<p>Website: ${layoutConfig.website}</p>` : ""}
            </div>
          </div>
        </div>
        <div class="header-right">
          <p><strong>Phone:</strong> ${layoutConfig?.phone || clinic?.phone || ""}</p>
          <p><strong>Email:</strong> ${layoutConfig?.email || clinic?.email || ""}</p>
        </div>
      </div>
    </div>
    
    <!-- Document Title -->
    <div class="document-title">
      <h2>${title}</h2>
    </div>
    
    <!-- Content -->
    <div class="content">
      <!-- Document Content -->
      <div class="document-content">
        ${formatContentForPrint(content)}
      </div>
      
      ${
        tags.length > 0
          ? `
      <!-- Tags Section -->
      <div class="tags-section">
        <h3>Tags</h3>
        <div>
          ${tags.map((tag) => `<span class="tag">${tag}</span>`).join("")}
        </div>
      </div>
      `
          : ""
      }
    </div>
    
    <!-- Footer -->
    <div class="footer">
      ${layoutConfig?.footerText ? `<p>${layoutConfig.footerText}</p>` : ""}
    </div>
  </div>
  
  <script>
    window.addEventListener('load', function() {
      setTimeout(function() {
        window.print();
      }, 500);
    });
    
    window.addEventListener('afterprint', function() {
      window.close();
    });
    
    window.addEventListener('beforeunload', function() {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage('printComplete', '*');
      }
    });
  </script>
</body>
</html>`;
  };

  const formatPreviewContent = (content: string) => {
    // Enhanced markdown-like parsing for preview
    let htmlContent = content
      // Headers
      .replace(
        /^### (.*$)/gim,
        '<h3 class="text-lg font-semibold mb-2 mt-4">$1</h3>',
      )
      .replace(
        /^## (.*$)/gim,
        '<h2 class="text-xl font-semibold mb-3 mt-4">$1</h2>',
      )
      .replace(
        /^# (.*$)/gim,
        '<h1 class="text-2xl font-bold mb-4 mt-4">$1</h1>',
      )
      // Bold and Italic
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
      // Underline and Strikethrough
      .replace(/<u>(.*?)<\/u>/g, '<span class="underline">$1</span>')
      .replace(/~~(.*?)~~/g, '<span class="line-through">$1</span>')
      // Lists
      .replace(/^• (.*$)/gim, '<li class="ml-4">• $1</li>')
      .replace(/^\d+\. (.*$)/gim, '<li class="ml-4">$1</li>')
      // Horizontal lines
      .replace(/^---$/gim, '<hr class="border-gray-300 my-4" />')
      // Line breaks
      .replace(/\n/g, "<br />");

    return <div dangerouslySetInnerHTML={{ __html: htmlContent }} />;
  };

  if (showPreview) {
    return (
      <div className="w-full">
        <div className="flex justify-between items-center mb-4 print:hidden">
          <h2 className="clarity-page-title">Print Preview</h2>
          <div className="flex gap-2">
            <button
              className="clarity-btn clarity-btn-primary"
              type="button"
              onClick={handlePrint}
            >
              <IoPrintOutline aria-hidden className="w-4 h-4" />
              Print
            </button>
            <button
              className="clarity-btn clarity-btn-ghost"
              type="button"
              onClick={() => setShowPreview(false)}
            >
              <IoEyeOutline aria-hidden className="w-4 h-4" />
              Back to Edit
            </button>
          </div>
        </div>

        <PrintLayout
          className="min-h-[800px]"
          documentDate={new Date().toLocaleDateString()}
          documentTitle={title}
          showInPrint={true}
        >
          <div className="p-6 text-sm">
            <div className="prose prose-sm max-w-none leading-relaxed">
              {formatPreviewContent(content)}
            </div>
          </div>
        </PrintLayout>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="clarity-card p-3">
        <div className="flex items-center justify-between w-full flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <IoDocumentTextOutline
              aria-hidden
              className="text-teal-700 text-2xl"
            />
            <h2 className="text-base font-semibold text-[rgb(var(--color-text))]">
              {document ? "Edit Document" : "New Document"}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="clarity-btn clarity-btn-ghost"
              type="button"
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              className="clarity-btn clarity-btn-tinted"
              disabled={!title.trim() || !content.trim()}
              type="button"
              onClick={() => setShowPreview(true)}
            >
              <IoEyeOutline aria-hidden className="w-4 h-4" />
              Preview
            </button>
            <button
              className="clarity-btn clarity-btn-primary"
              disabled={!title.trim() || saving}
              type="button"
              onClick={() => handleSave(true)}
            >
              <IoSaveOutline aria-hidden className="w-4 h-4" />
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>

      {/* Document Details */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3 space-y-4">
          {/* Title and Quick Formatting */}
          <div className="clarity-card p-3 space-y-4">
            <div>
              <label className="block text-xs font-medium text-[rgb(var(--color-text-muted))] mb-1">
                Document Title
              </label>
              <input
                aria-required
                required
                className="clarity-input w-full"
                placeholder="Enter document title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {/* Medical Templates */}
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs font-medium text-[rgb(var(--color-text-muted))] mr-2">
                Medical Templates:
              </span>
              <div ref={templateDropdownRef} className="relative">
                <button
                  aria-expanded={templateDropdownOpen}
                  aria-haspopup="true"
                  className="clarity-btn clarity-btn-ghost text-xs"
                  type="button"
                  onClick={() => setTemplateDropdownOpen((o) => !o)}
                >
                  Templates
                  <IoChevronDownOutline aria-hidden className="w-4 h-4" />
                </button>
                {templateDropdownOpen && (
                  <div
                    className="absolute left-0 top-full mt-1 min-w-[180px] clarity-card py-1 z-10"
                    role="menu"
                  >
                    <button
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-[rgb(var(--color-surface-2))]"
                      role="menuitem"
                      type="button"
                      onClick={() => {
                        insertTemplate(
                          "\n\nPatient Name: \nDate: \nComplaint: \nExamination: \nDiagnosis: \nTreatment: \nFollow-up: \n\n",
                        );
                        setTemplateDropdownOpen(false);
                      }}
                    >
                      Medical Note
                    </button>
                    <button
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-[rgb(var(--color-surface-2))]"
                      role="menuitem"
                      type="button"
                      onClick={() => {
                        insertTemplate(
                          "\n\nPRESCRIPTION\n\nPatient: \nDate: \n\nMedications:\n• \n• \n• \n\nInstructions:\n\nDoctor: \n\n",
                        );
                        setTemplateDropdownOpen(false);
                      }}
                    >
                      Prescription
                    </button>
                    <button
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-[rgb(var(--color-surface-2))]"
                      role="menuitem"
                      type="button"
                      onClick={() => {
                        insertTemplate(
                          "\n\nLABORATORY REQUEST\n\nPatient: \nDate: \n\nTests Requested:\n• \n• \n• \n\nClinical Information:\n\nDoctor: \n\n",
                        );
                        setTemplateDropdownOpen(false);
                      }}
                    >
                      Lab Request
                    </button>
                    <button
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-[rgb(var(--color-surface-2))]"
                      role="menuitem"
                      type="button"
                      onClick={() => {
                        insertTemplate(
                          "\n\nDate: " +
                            new Date().toLocaleDateString() +
                            "\nTime: " +
                            new Date().toLocaleTimeString() +
                            "\n\nPatient: \nChief Complaint: \n\nHistory of Present Illness:\n\nPhysical Examination:\n\nAssessment:\n\nPlan:\n\n",
                        );
                        setTemplateDropdownOpen(false);
                      }}
                    >
                      Consultation Note
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Content Editor - Priority Position */}
          <div className="clarity-card overflow-hidden">
            <div className="flex justify-between items-center flex-wrap gap-2 bg-[rgb(var(--color-surface-2))] border-b border-[rgb(var(--color-border))] px-4 py-3">
              <h3 className="text-base font-semibold text-[rgb(var(--color-text))]">
                Write Your Document
              </h3>
              <div className="text-xs text-[rgb(var(--color-text-muted))] flex items-center gap-4">
                <span>Characters: {content.length}</span>
                <span>
                  Words:{" "}
                  {content.trim() ? content.trim().split(/\s+/).length : 0}
                </span>
                <button
                  className="clarity-btn clarity-btn-ghost"
                  disabled={!content.trim()}
                  type="button"
                  onClick={() => setShowPreview(true)}
                >
                  <IoEyeOutline aria-hidden className="w-4 h-4" />
                  Preview
                </button>
              </div>
            </div>
            <div className="p-0">
              <ReactQuill
                ref={quillRef}
                formats={quillFormats}
                modules={quillModules}
                placeholder="Start writing your document content here..."
                style={{
                  height: "600px",
                  border: "none",
                }}
                theme="snow"
                value={content}
                onChange={setContent}
              />
            </div>
          </div>
        </div>

        {/* Compact Sidebar */}
        <div className="space-y-4">
          {/* Tags */}
          <div className="clarity-card p-3">
            <h3 className="text-base font-semibold text-[rgb(var(--color-text))] mb-3">
              Tags
            </h3>
            <div className="flex gap-2">
              <input
                aria-label="Add tag"
                className="clarity-input flex-1 min-w-0"
                placeholder="Add tag"
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && (e.preventDefault(), handleAddTag())
                }
              />
              <button
                aria-label="Add tag"
                className="clarity-btn clarity-btn-primary h-8 w-8 p-0 justify-center shrink-0"
                disabled={!tagInput.trim() || tags.includes(tagInput.trim())}
                type="button"
                onClick={handleAddTag}
              >
                <IoAddOutline aria-hidden className="w-4 h-4" />
              </button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="clarity-badge bg-teal-100 text-teal-700 inline-flex items-center gap-1"
                  >
                    {tag}
                    <button
                      aria-label={`Remove tag ${tag}`}
                      className="ml-0.5 rounded p-0.5 hover:bg-teal-200 focus:outline-none"
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                    >
                      <IoCloseOutline aria-hidden className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Rich Text Editor Info */}
          <div className="clarity-card p-3">
            <h3 className="text-base font-semibold text-[rgb(var(--color-text))] mb-2">
              Rich Text Features
            </h3>
            <div className="text-sm text-[rgb(var(--color-text-muted))] space-y-2">
              <p>Use the toolbar above the editor for:</p>
              <ul className="text-xs space-y-1 ml-4">
                <li>• Headings, Bold, Italic, Underline</li>
                <li>• Bullet and numbered lists</li>
                <li>• Text alignment options</li>
                <li>• Links and more formatting</li>
              </ul>
              <p className="text-xs mt-2">
                All formatting is applied automatically.
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="clarity-card p-3">
            <h3 className="text-base font-semibold text-[rgb(var(--color-text))] mb-2">
              Actions
            </h3>
            <div className="space-y-2">
              <button
                className="clarity-btn clarity-btn-tinted justify-start w-full"
                disabled={!title.trim() || !content.trim()}
                type="button"
                onClick={() => setShowPreview(true)}
              >
                <IoEyeOutline aria-hidden className="w-4 h-4 shrink-0" />
                Preview Document
              </button>
              <button
                className="clarity-btn clarity-btn-ghost justify-start w-full"
                disabled={!title.trim() || !content.trim()}
                type="button"
                onClick={handlePrint}
              >
                <IoPrintOutline aria-hidden className="w-4 h-4 shrink-0" />
                Print Document
              </button>
            </div>
          </div>

          {/* Document Info */}
          {document && (
            <div className="clarity-card p-3">
              <h3 className="text-base font-semibold text-[rgb(var(--color-text))] mb-2">
                Document Info
              </h3>
              <div className="space-y-2 text-xs">
                <div>
                  <span className="font-medium text-[rgb(var(--color-text-muted))]">
                    Created:
                  </span>
                  <p className="text-[rgb(var(--color-text-muted))]">
                    {document.createdAt.toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-[rgb(var(--color-text-muted))]">
                    Modified:
                  </span>
                  <p className="text-[rgb(var(--color-text-muted))]">
                    {document.updatedAt.toLocaleDateString()}
                  </p>
                </div>
                {branchId && (
                  <div>
                    <span className="font-medium text-[rgb(var(--color-text-muted))]">
                      Branch:
                    </span>
                    <p className="text-[rgb(var(--color-text-muted))]">
                      Branch document
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Keyboard Shortcuts Guide */}
          <div className="clarity-card p-3">
            <h3 className="text-base font-semibold text-[rgb(var(--color-text))] mb-2">
              Shortcuts
            </h3>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-[rgb(var(--color-text-muted))]">
                  Bold:
                </span>
                <code className="bg-[rgb(var(--color-surface-2))] px-1 rounded">
                  Ctrl+B
                </code>
              </div>
              <div className="flex justify-between">
                <span className="text-[rgb(var(--color-text-muted))]">
                  Italic:
                </span>
                <code className="bg-[rgb(var(--color-surface-2))] px-1 rounded">
                  Ctrl+I
                </code>
              </div>
              <div className="flex justify-between">
                <span className="text-[rgb(var(--color-text-muted))]">
                  Save:
                </span>
                <code className="bg-[rgb(var(--color-surface-2))] px-1 rounded">
                  Ctrl+S
                </code>
              </div>
            </div>
            <div className="clarity-divider my-2" />
            <div className="space-y-1 text-xs">
              <p className="font-medium text-[rgb(var(--color-text-muted))] mb-1">
                Format Guide:
              </p>
              <p>
                <code className="bg-[rgb(var(--color-surface-2))] px-1 rounded text-xs">
                  **bold**
                </code>{" "}
                → <strong>bold</strong>
              </p>
              <p>
                <code className="bg-[rgb(var(--color-surface-2))] px-1 rounded text-xs">
                  *italic*
                </code>{" "}
                → <em>italic</em>
              </p>
              <p>
                <code className="bg-[rgb(var(--color-surface-2))] px-1 rounded text-xs">
                  # Heading
                </code>{" "}
                → Heading
              </p>
              <p>
                <code className="bg-[rgb(var(--color-surface-2))] px-1 rounded text-xs">
                  • Item
                </code>{" "}
                → Bullet
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
