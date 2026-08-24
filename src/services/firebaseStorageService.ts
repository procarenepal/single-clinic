import { storage } from "@/config/firebase";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  UploadTaskSnapshot,
} from "firebase/storage";
import { v4 as uuidv4 } from "uuid";

/**
 * Interface for upload progress callback
 */
export type UploadProgressCallback = (progress: number) => void;

/**
 * Upload a file to Firebase storage
 *
 * @param file The file object to upload
 * @param path The storage path (e.g., 'logos', 'xrays', 'documents')
 * @param onProgress Optional callback to track upload progress (0-100)
 * @returns Promise resolving to the file's download URL
 */
export const uploadFileToFirebase = async (
  file: File,
  path: string,
  onProgress?: UploadProgressCallback
): Promise<{ fileId: string; url: string }> => {
  return new Promise((resolve, reject) => {
    // Generate a unique file name to avoid collisions
    const fileExtension = file.name.split(".").pop();
    const fileId = `${uuidv4()}.${fileExtension}`;
    const fullPath = `${path}/${fileId}`;

    const storageRef = ref(storage, fullPath);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      "state_changed",
      (snapshot: UploadTaskSnapshot) => {
        if (onProgress) {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          onProgress(progress);
        }
      },
      (error) => {
        console.error("Firebase upload error:", error);
        reject(error);
      },
      async () => {
        // Upload completed successfully
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          resolve({ fileId: fullPath, url: downloadURL });
        } catch (error) {
          reject(error);
        }
      }
    );
  });
};

/**
 * Delete a file from Firebase storage
 *
 * @param fileId The full storage path/id (e.g., 'logos/123.png')
 */
export const deleteFileFromFirebase = async (fileId: string): Promise<void> => {
  if (!fileId) return;
  try {
    // If it's a full URL, we extract the path
    let storagePath = fileId;
    if (fileId.startsWith("http")) {
       // A Firebase Storage URL looks like: https://firebasestorage.googleapis.com/v0/b/BUCKET/o/PATH?alt=media
       try {
         const urlObj = new URL(fileId);
         const pathParts = urlObj.pathname.split('/o/');
         if (pathParts.length > 1) {
           storagePath = decodeURIComponent(pathParts[1]);
         }
       } catch (e) {
         console.warn("Could not parse file URL for deletion:", fileId);
       }
    }
    
    const fileRef = ref(storage, storagePath);
    await deleteObject(fileRef);
  } catch (error: any) {
    // If the file doesn't exist, we can ignore the error
    if (error.code !== "storage/object-not-found") {
      console.error("Firebase delete error:", error);
      throw error;
    }
  }
};

/**
 * Get file download URL from Firebase storage
 * Note: If you already stored the downloadURL during upload, you don't need this.
 *
 * @param fileId The full storage path/id
 */
export const getFileUrlFromFirebase = async (fileId: string): Promise<string> => {
  if (!fileId) return "";
  
  // If it's already a full HTTP URL (from previous uploads), return it
  if (fileId.startsWith("http")) return fileId;

  try {
    const fileRef = ref(storage, fileId);
    return await getDownloadURL(fileRef);
  } catch (error) {
    console.error("Firebase get URL error:", error);
    return "";
  }
};
