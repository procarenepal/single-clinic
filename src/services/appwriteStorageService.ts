import { ImageGravity, ImageFormat } from "appwrite";

import { storage, APPWRITE_BUCKET_ID, ID } from "@/config/appwrite";

export interface UploadResult {
  fileId: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
}

/**
 * Upload a file to Appwrite storage
 * @param file - File to upload
 * @param fileName - Optional custom filename
 * @returns Upload result with file details
 */
export const uploadFile = async (
  file: File,
  fileName?: string,
): Promise<UploadResult> => {
  try {
    // Generate unique filename if not provided
    const timestamp = Date.now();
    const fileExtension = file.name.split(".").pop();
    const finalFileName = fileName || `${timestamp}-${file.name}`;

    // Create unique file ID
    const fileId = ID.unique();

    // Upload file to Appwrite
    const uploadedFile = await storage.createFile(
      APPWRITE_BUCKET_ID,
      fileId,
      file,
    );

    // Get file preview/download URL
    const fileUrl = storage.getFileView(APPWRITE_BUCKET_ID, fileId);

    return {
      fileId: uploadedFile.$id,
      fileName: finalFileName,
      fileUrl: fileUrl.toString(),
      fileSize: file.size,
      mimeType: file.type,
    };
  } catch (error) {
    console.error("Appwrite upload error:", error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }
};

/**
 * Upload an image with automatic optimization
 * @param file - Image file to upload
 * @param fileName - Optional custom filename
 * @param maxWidth - Max width for resizing (optional)
 * @param maxHeight - Max height for resizing (optional)
 * @returns Upload result with optimized image details
 */
export const uploadImage = async (
  file: File,
  fileName?: string,
  maxWidth?: number,
  maxHeight?: number,
): Promise<UploadResult> => {
  try {
    // Validate file type
    if (!file.type.startsWith("image/")) {
      throw new Error("File must be an image");
    }

    // Upload the image
    const result = await uploadFile(file, fileName);

    // If dimensions specified, get optimized URL
    // NOTE: Image transformations are blocked on Appwrite Free Tier.
    // We will just use the original uploaded file URL instead.
    /*
    if (maxWidth || maxHeight) {
      const optimizedUrl = storage.getFilePreview(
        APPWRITE_BUCKET_ID,
        result.fileId,
        maxWidth,
        maxHeight,
        ImageGravity.Center,
        100, // quality
        0, // border width
        "000000", // border color (valid hex color, but won't be visible with 0 border width)
        0, // border radius
        1, // opacity
        0, // rotation
        "ffffff", // background color (white)
        ImageFormat.Webp, // output format
      );

      result.fileUrl = optimizedUrl.toString();
    }
    */

    return result;
  } catch (error) {
    console.error("Image upload error:", error);
    throw error;
  }
};

/**
 * Upload a document (PDF, DOC, etc.)
 * @param file - Document file to upload
 * @param fileName - Optional custom filename
 * @returns Upload result with document details
 */
export const uploadDocument = async (
  file: File,
  fileName?: string,
): Promise<UploadResult> => {
  try {
    // Validate file type for documents
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
      throw new Error("File type not supported for documents");
    }

    return await uploadFile(file, fileName);
  } catch (error) {
    console.error("Document upload error:", error);
    throw error;
  }
};

/**
 * Delete a file from Appwrite storage
 * @param fileId - ID of the file to delete
 * @returns Promise<void>
 */
export const deleteFile = async (fileId: string): Promise<void> => {
  try {
    await storage.deleteFile(APPWRITE_BUCKET_ID, fileId);
  } catch (error) {
    console.error("File deletion error:", error);
    throw new Error(`Failed to delete file: ${error.message}`);
  }
};

/**
 * Get file details from Appwrite
 * @param fileId - ID of the file
 * @returns File details
 */
export const getFileDetails = async (fileId: string) => {
  try {
    return await storage.getFile(APPWRITE_BUCKET_ID, fileId);
  } catch (error) {
    console.error("Get file details error:", error);
    throw new Error(`Failed to get file details: ${error.message}`);
  }
};

/**
 * List all files in the bucket (with optional search)
 * @param search - Optional search query
 * @param limit - Number of files to return (default: 25)
 * @returns List of files
 */
export const listFiles = async (search?: string, limit: number = 25) => {
  try {
    return await storage.listFiles(
      APPWRITE_BUCKET_ID,
      search ? [search] : undefined,
      limit.toString(),
    );
  } catch (error) {
    console.error("List files error:", error);
    throw new Error(`Failed to list files: ${error.message}`);
  }
};
