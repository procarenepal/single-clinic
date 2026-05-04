/**
 * AddXrayModal — Clinic Clarity, zero HeroUI
 * Replaced: Modal, Button, Textarea, Card, CardBody, Progress (@heroui)
 * Uses createPortal to guarantee full-viewport overlay.
 */
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  IoCloseOutline,
  IoImageOutline,
  IoDocumentOutline,
  IoCloudUploadOutline,
} from "react-icons/io5";

import { Button } from "@/components/ui/button";

interface AddXrayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (
    xray: any,
    files?: File[],
    onProgress?: (progress: number) => void,
  ) => void;
}

const fmtSize = (b: number) => {
  if (b === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(b) / Math.log(1024));

  return `${parseFloat((b / Math.pow(1024, i)).toFixed(2))} ${units[i]}`;
};

export default function AddXrayModal({
  isOpen,
  onClose,
  onSubmit,
}: AddXrayModalProps) {
  const [note, setNote] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  // Lock real scroll container
  useEffect(() => {
    if (!isOpen) return;
    const el = (document.getElementById("dashboard-scroll-container") ??
      document.body) as HTMLElement;
    const prev = el.style.overflow;

    el.style.overflow = "hidden";

    return () => {
      el.style.overflow = prev;
    };
  }, [isOpen]);

  const reset = () => {
    setNote("");
    setSelectedFile(null);
    setUploadProgress(0);
    setIsUploading(false);
  };

  const handleSubmit = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    setUploadProgress(0);
    try {
      await onSubmit({ note }, [selectedFile], (p) => setUploadProgress(p));
      reset();
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  if (!isOpen) return null;

  const isImg = selectedFile?.type.startsWith("image/");

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4 overflow-hidden"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isUploading) {
          reset();
          onClose();
        }
      }}
    >
      <div
        className="bg-surface border border-border-base rounded-[10px] w-full max-w-lg flex flex-col max-h-[90vh]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-base/50 shrink-0">
          <h3 className="text-[14px] font-semibold text-text-main">
            Add X-ray Record
          </h3>
          {!isUploading && (
            <button
              className="text-text-muted/60 hover:text-text-main transition-colors"
              type="button"
              onClick={() => {
                reset();
                onClose();
              }}
            >
              <IoCloseOutline className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          {/* File picker */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[12px] font-medium text-text-main">
                X-ray File <span className="text-red-500">*</span>
              </label>
              <button
                className="text-[11.5px] font-medium px-2.5 py-1 rounded-[10px] border border-primary/20 text-primary bg-primary/5 hover:bg-primary/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                disabled={!!selectedFile || isUploading}
                type="button"
                onClick={() =>
                  document.getElementById("xray-file-input")?.click()
                }
              >
                {selectedFile ? "File Selected" : "Choose File"}
              </button>
            </div>
            <input
              accept="image/*,.pdf,.doc,.docx"
              className="hidden"
              id="xray-file-input"
              type="file"
              onChange={(e) =>
                e.target.files?.[0] && setSelectedFile(e.target.files[0])
              }
            />
            <p className="text-[10.5px] text-text-muted">
              Supported: JPG, JPEG, PNG, GIF, WEBP, PDF, DOC, DOCX
            </p>

            {/* Selected file card */}
            {selectedFile && (
              <div className="flex items-center gap-3 border border-primary/20 bg-primary/5 rounded-[10px] px-3 py-2">
                {isImg ? (
                  <IoImageOutline className="w-4 h-4 text-primary shrink-0" />
                ) : (
                  <IoDocumentOutline className="w-4 h-4 text-primary shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[12.5px] font-medium text-text-main truncate">
                    {selectedFile.name}
                  </p>
                  <p className="text-[10.5px] text-text-muted">
                    {fmtSize(selectedFile.size)}
                  </p>
                </div>
                {!isUploading && (
                  <button
                    className="text-text-muted/60 hover:text-red-500 transition-colors shrink-0"
                    type="button"
                    onClick={() => setSelectedFile(null)}
                  >
                    <IoCloseOutline className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}

            {/* Progress bar */}
            {isUploading && (
              <div className="space-y-1">
                <div className="flex justify-between text-[11.5px] text-text-muted">
                  <span className="flex items-center gap-1">
                    <IoCloudUploadOutline className="w-3.5 h-3.5 text-primary" />{" "}
                    Uploading…
                  </span>
                  <span className="font-semibold">
                    {Math.round(uploadProgress)}%
                  </span>
                </div>
                <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Note */}
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-medium text-text-main">
              Note (Optional)
            </label>
            <textarea
              className="w-full px-2.5 py-2 text-[12.5px] border border-border-base rounded-[10px] bg-surface text-text-main
                placeholder:text-text-muted/40 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/10
                disabled:bg-surface-2 resize-y"
              disabled={isUploading}
              placeholder="Add an optional note or description for this X-ray…"
              rows={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-border-base/50 shrink-0">
          <Button
            color="default"
            disabled={isUploading}
            size="sm"
            variant="bordered"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Cancel
          </Button>
          <Button
            color="primary"
            disabled={!selectedFile || isUploading}
            isLoading={isUploading}
            size="sm"
            onClick={handleSubmit}
          >
            {isUploading ? "Uploading…" : "Add X-ray"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
