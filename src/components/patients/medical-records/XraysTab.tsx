/**
 * XraysTab — Clinic Clarity, zero HeroUI
 * Replaced: Card, CardBody, Button (@heroui)
 */
import { useState, useEffect } from "react";
import {
  IoImageOutline,
  IoAddOutline,
  IoEyeOutline,
  IoDownloadOutline,
  IoDocumentOutline,
  IoTrashOutline,
} from "react-icons/io5";

import AddXrayModal from "./AddXrayModal.tsx";

import { Button } from "@/components/ui/button";
import { XrayRecord } from "@/types/models";
import { MedicalRecordsService } from "@/services/medicalRecordsService";

interface XraysTabProps {
  xrayRecords: XrayRecord[];
  onAddXray: (
    xray: any,
    files?: File[],
    onProgress?: (progress: number) => void,
  ) => void;
  onDeleteXray: (xrayId: string) => void;
  deletingXrayId?: string | null;
}

// ── File preview (no HeroUI — unchanged logic, restyled) ──────────────────────
function XrayFilePreview({
  fileId,
  fileName,
}: {
  fileId: string | undefined;
  fileName?: string;
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isImage, setIsImage] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (fileId) {
        try {
          const url = MedicalRecordsService.getFileViewUrl(fileId);
          const img = fileName
            ? /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName)
            : true;

          setIsImage(img);
          if (img) setImageUrl(url);
        } catch (e) {
          console.error(e);
        }
      }
      setLoading(false);
    };

    load();
  }, [fileId, fileName]);

  if (loading) {
    return (
      <div className="aspect-square bg-surface-2 border border-border-base/50 rounded-[10px] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="aspect-square bg-surface-2 border border-border-base/50 rounded-[10px] flex items-center justify-center overflow-hidden">
      {isImage && imageUrl ? (
        <img
          alt="X-ray"
          className="w-full h-full object-cover"
          src={imageUrl}
          onError={() => setImageUrl(null)}
        />
      ) : (
        <div className="text-center p-3">
          <IoDocumentOutline className="mx-auto w-10 h-10 text-primary/40 mb-1" />
          <p className="text-[11.5px] font-medium text-primary">Document</p>
          {fileName && (
            <p className="text-[10.5px] text-text-muted mt-0.5 truncate max-w-[120px]">
              {fileName.length > 20
                ? `${fileName.substring(0, 20)}…`
                : fileName}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function XraysTab({
  xrayRecords,
  onAddXray,
  onDeleteXray,
  deletingXrayId,
}: XraysTabProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fmtDate = (d: Date) =>
    new Date(d).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  const handleDownload = (fileId: string) => {
    try {
      const url = MedicalRecordsService.getFileDownloadUrl(fileId);
      const a = document.createElement("a");

      a.href = url;
      a.download = `xray-${fileId}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      console.error(e);
    }
  };

  const handleView = (fileId: string) => {
    try {
      window.open(MedicalRecordsService.getFileViewUrl(fileId), "_blank");
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-[13px] font-semibold text-text-main">
            X-rays & Imaging
          </h4>
          <p className="text-[11.5px] text-text-muted">
            {xrayRecords.length}{" "}
            {xrayRecords.length === 1 ? "record" : "records"}
          </p>
        </div>
        <Button
          color="primary"
          size="sm"
          startContent={<IoAddOutline className="w-3.5 h-3.5" />}
          onClick={() => setIsModalOpen(true)}
        >
          Add X-ray
        </Button>
      </div>

      {/* Empty state */}
      {xrayRecords.length === 0 ? (
        <div className="py-12 text-center border border-dashed border-border-base rounded">
          <IoImageOutline className="mx-auto w-10 h-10 text-text-muted/30 mb-3" />
          <p className="text-[13px] font-medium text-text-main mb-1">
            No X-rays
          </p>
          <p className="text-[12px] text-text-muted mb-4">
            No X-ray files have been added yet.
          </p>
          <Button
            color="primary"
            size="sm"
            startContent={<IoAddOutline className="w-3.5 h-3.5" />}
            onClick={() => setIsModalOpen(true)}
          >
            Add First X-ray
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {xrayRecords.map((record) => (
            <div
              key={record.id}
              className="border border-border-base rounded-[10px] overflow-hidden hover:border-primary/50 transition-colors"
            >
              {/* Card header */}
              <div className="flex items-center justify-between px-3 py-2 bg-surface-2 border-b border-border-base/50">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-primary/10 border border-primary/20 rounded">
                    <IoImageOutline className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <p className="text-[12.5px] font-semibold text-text-main">
                    X-ray Record
                  </p>
                </div>
                <p className="text-[11px] text-text-muted">
                  {fmtDate(record.createdAt)}
                </p>
              </div>

              {/* Preview */}
              <div className="p-3">
                {record.file ? (
                  <XrayFilePreview
                    fileId={record.file}
                    fileName={`xray-${record.id}`}
                  />
                ) : (
                  <div className="aspect-square bg-surface-2 border border-border-base/50 rounded-[10px] flex items-center justify-center">
                    <div className="text-center">
                      <IoImageOutline className="mx-auto w-8 h-8 text-text-muted/30 mb-1" />
                      <p className="text-[11.5px] text-text-muted">
                        No file attached
                      </p>
                    </div>
                  </div>
                )}

                {/* Note */}
                {record.note && (
                  <p className="text-[12px] text-text-muted bg-surface-2 border border-border-base/50 rounded-[10px] px-2 py-1.5 mt-2 line-clamp-2">
                    {record.note}
                  </p>
                )}

                {/* Actions */}
                <div className="flex items-center gap-1.5 flex-wrap mt-2">
                  {record.file ? (
                    <>
                      <Button
                        color="default"
                        size="sm"
                        startContent={<IoEyeOutline className="w-3 h-3" />}
                        variant="bordered"
                        onClick={() => handleView(record.file!)}
                      >
                        View
                      </Button>
                      <Button
                        color="default"
                        size="sm"
                        startContent={<IoDownloadOutline className="w-3 h-3" />}
                        variant="bordered"
                        onClick={() => handleDownload(record.file!)}
                      >
                        Download
                      </Button>
                    </>
                  ) : (
                    <span className="text-[11.5px] text-text-muted">
                      No file
                    </span>
                  )}
                  <Button
                    color="danger"
                    disabled={deletingXrayId === record.id}
                    isLoading={deletingXrayId === record.id}
                    size="sm"
                    startContent={<IoTrashOutline className="w-3 h-3" />}
                    variant="bordered"
                    onClick={() => onDeleteXray(record.id)}
                  >
                    {deletingXrayId === record.id ? "Deleting…" : "Delete"}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <AddXrayModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={onAddXray}
      />
    </div>
  );
}
