import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { IoArrowBackOutline } from "react-icons/io5";

import { addToast } from "@/components/ui/toast";
import { TextEditorComponent } from "@/components/text-editor/TextEditorComponent";
import { TextDocument } from "@/types/textEditor";
import { textEditorService } from "@/services/textEditorService";
import { useAuthContext } from "@/context/AuthContext";

export default function EditTextDocumentPage() {
  const { documentId } = useParams<{ documentId: string }>();
  const navigate = useNavigate();
  const { clinicId } = useAuthContext();

  const [document, setDocument] = useState<TextDocument | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (documentId && clinicId) {
      loadDocument();
    } else {
      setLoading(false);
    }
  }, [documentId, clinicId]);

  const loadDocument = async () => {
    if (!documentId) return;
    try {
      setLoading(true);
      const doc = await textEditorService.getDocumentById(documentId);

      if (!doc) {
        addToast({
          title: "Error",
          description: "Document not found",
          color: "danger",
        });
        navigate("/dashboard/text-editor");

        return;
      }
      if (doc.clinicId !== clinicId) {
        addToast({
          title: "Access Denied",
          description: "You don't have permission to access this document",
          color: "danger",
        });
        navigate("/dashboard/text-editor");

        return;
      }
      setDocument(doc);
    } catch (error) {
      console.error("Error loading document:", error);
      addToast({
        title: "Error",
        description: "Failed to load document",
        color: "danger",
      });
      navigate("/dashboard/text-editor");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = (savedDocument: TextDocument) => {
    addToast({
      title: "Success",
      description: `Document ${document ? "updated" : "created"} successfully`,
      color: "success",
    });
    navigate("/dashboard/text-editor");
  };

  const handleCancel = () => {
    navigate("/dashboard/text-editor");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96 text-[rgb(var(--color-text-muted))]">
        Loading document...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          aria-label="Back to documents"
          className="clarity-btn clarity-btn-ghost h-8 w-8 p-0 justify-center"
          type="button"
          onClick={() => navigate("/dashboard/text-editor")}
        >
          <IoArrowBackOutline aria-hidden className="w-4 h-4" />
        </button>
        <div>
          <h1 className="clarity-page-title">
            {document ? "Edit Document" : "New Document"}
          </h1>
          <p className="clarity-page-subtitle">
            {document
              ? `Editing "${document.title}"`
              : "Create a new text document"}
          </p>
        </div>
      </div>

      <TextEditorComponent
        clinicId={clinicId}
        document={document || undefined}
        onCancel={handleCancel}
        onSave={handleSave}
      />
    </div>
  );
}
