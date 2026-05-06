import React, { useState } from "react";
import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";
import { Spinner } from "@heroui/spinner";
import { addToast } from "@heroui/toast";
import {
  IoCloudUploadOutline,
  IoDocumentOutline,
  IoImageOutline,
  IoTrashOutline,
  IoEyeOutline,
} from "react-icons/io5";

import {
  uploadFile,
  uploadImage,
  uploadDocument,
  deleteFile,
  UploadResult,
} from "@/services/appwriteStorageService";

interface FileUploadComponentProps {
  onUploadComplete?: (result: UploadResult) => void;
  onFileDelete?: (fileId: string) => void;
  acceptedTypes?: string;
  maxSize?: number; // in MB
  uploadType?: "image" | "document" | "any";
  currentFile?: {
    id: string;
    name: string;
    url: string;
    type: string;
  };
}

export const FileUploadComponent: React.FC<FileUploadComponentProps> = ({
  onUploadComplete,
  onFileDelete,
  acceptedTypes = "image/*,application/pdf,.doc,.docx,.txt,.csv,.xlsx,.xls",
  maxSize = 10, // 10MB default
  uploadType = "any",
  currentFile,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const getAcceptedTypes = () => {
    switch (uploadType) {
      case "image":
        return "image/*";
      case "document":
        return "application/pdf,.doc,.docx,.txt,.csv,.xlsx,.xls";
      default:
        return acceptedTypes;
    }
  };

  const validateFile = (file: File): boolean => {
    // Check file size
    if (file.size > maxSize * 1024 * 1024) {
      addToast({
        title: "Error",
        description: `File size should be less than ${maxSize}MB`,
        color: "danger",
      });

      return false;
    }

    // Check file type based on upload type
    if (uploadType === "image" && !file.type.startsWith("image/")) {
      addToast({
        title: "Error",
        description: "Please select a valid image file",
        color: "danger",
      });

      return false;
    }

    if (uploadType === "document") {
      const allowedTypes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "text/plain",
        "text/csv",
      ];

      if (!allowedTypes.includes(file.type)) {
        addToast({
          title: "Error",
          description:
            "File type not supported. Please upload PDF, DOC, DOCX, TXT, CSV, or Excel files.",
          color: "danger",
        });

        return false;
      }
    }

    return true;
  };

  const handleFileUpload = async (file: File) => {
    if (!validateFile(file)) return;

    try {
      setIsUploading(true);

      let result: UploadResult;

      // Choose upload method based on type
      switch (uploadType) {
        case "image":
          result = await uploadImage(file, undefined, 1200, 1200); // Optimize images
          break;
        case "document":
          result = await uploadDocument(file);
          break;
        default:
          result = await uploadFile(file);
      }

      addToast({
        title: "Success",
        description: `${uploadType === "image" ? "Image" : "File"} uploaded successfully!`,
        color: "success",
      });

      onUploadComplete?.(result);
    } catch (error) {
      console.error("Upload error:", error);
      addToast({
        title: "Error",
        description: error.message || "Failed to upload file",
        color: "danger",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (file) {
      handleFileUpload(file);
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);

    const file = event.dataTransfer.files[0];

    if (file) {
      handleFileUpload(file);
    }
  };

  const handleDelete = async () => {
    if (!currentFile?.id) return;

    try {
      await deleteFile(currentFile.id);
      addToast({
        title: "Success",
        description: "File deleted successfully",
        color: "success",
      });
      onFileDelete?.(currentFile.id);
    } catch (error) {
      addToast({
        title: "Error",
        description: "Failed to delete file",
        color: "danger",
      });
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith("image/")) {
      return <IoImageOutline className="w-6 h-6" />;
    }

    return <IoDocumentOutline className="w-6 h-6" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="space-y-4">
      {/* Current File Display */}
      {currentFile && !isUploading && (
        <Card>
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getFileIcon(currentFile.type)}
                <div>
                  <p className="font-medium text-sm">{currentFile.name}</p>
                  <p className="text-xs text-default-500">Stored in Appwrite</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  isIconOnly
                  as="a"
                  href={currentFile.url}
                  rel="noopener noreferrer"
                  size="sm"
                  target="_blank"
                  variant="flat"
                >
                  <IoEyeOutline />
                </Button>
                <Button
                  isIconOnly
                  color="danger"
                  size="sm"
                  variant="flat"
                  onPress={handleDelete}
                >
                  <IoTrashOutline />
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Upload Area */}
      {/* Slim Upload Area */}
      {!currentFile && (
        <div className="flex items-center gap-4 p-2 border border-dashed border-default-300 rounded-lg bg-default-50/50">
          <div className="flex-1 flex items-center gap-2 px-1">
            <IoCloudUploadOutline className="w-5 h-5 text-default-400" />
            <div className="flex flex-col">
              <p className="font-semibold text-[11px] text-default-600 leading-tight">
                {uploadType === "image" ? "Staff Photo" : "Upload File"}
              </p>
              <p className="text-[9px] text-default-400 leading-tight">Max {maxSize}MB</p>
            </div>
          </div>
          <input
            accept={getAcceptedTypes()}
            className="hidden"
            id="file-upload"
            type="file"
            onChange={handleFileInput}
          />
          <Button
            as="label"
            className="cursor-pointer h-7 px-3 text-[10px] font-bold"
            color="primary"
            htmlFor="file-upload"
            isLoading={isUploading}
            size="sm"
            variant="flat"
          >
            {isUploading ? "Uploading..." : "Choose File"}
          </Button>
        </div>
      )}
    </div>
  );
};

export default FileUploadComponent;
