import {
  collection,
  doc,
  addDoc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";

import { db, auth } from "@/config/firebase";
import { storage, APPWRITE_BUCKET_ID, ID } from "@/config/appwrite";
import { MedicalDocument, XrayRecord } from "@/types/models";

const DOCUMENTS_COLLECTION = "medical_documents";
const XRAYS_COLLECTION = "xray_records";

export interface UploadFileResult {
  fileId: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
}

export class MedicalRecordsService {
  // =================== FILE UPLOAD METHODS ===================

  /**
   * Upload file to Appwrite storage
   */
  static async uploadFile(file: File): Promise<UploadFileResult> {
    try {
      const fileId = ID.unique();

      const uploadedFile = await storage.createFile(
        APPWRITE_BUCKET_ID,
        fileId,
        file,
      );

      // Get file view URL
      const fileUrl = storage.getFileView(APPWRITE_BUCKET_ID, fileId);

      return {
        fileId: uploadedFile.$id,
        fileName: file.name,
        fileUrl: fileUrl.toString(),
        fileSize: file.size,
        mimeType: file.type,
      };
    } catch (error) {
      console.error("Error uploading file to Appwrite:", error);
      throw new Error("Failed to upload file");
    }
  }

  /**
   * Upload file to Appwrite storage with progress callback
   */
  static async uploadFileWithProgress(
    file: File,
    onProgress?: (progress: number) => void,
  ): Promise<UploadFileResult> {
    try {
      const fileId = ID.unique();

      // Simulate progress for Appwrite upload since it doesn't provide native progress
      let currentProgress = 0;
      const progressInterval = setInterval(() => {
        if (onProgress && currentProgress < 90) {
          // Simulate realistic upload progress with variable speed
          const increment = Math.random() * 15 + 5; // Between 5-20% increments

          currentProgress = Math.min(90, currentProgress + increment);
          onProgress(currentProgress);
        }
      }, 200);

      const uploadedFile = await storage.createFile(
        APPWRITE_BUCKET_ID,
        fileId,
        file,
      );

      clearInterval(progressInterval);

      // Complete progress
      if (onProgress) {
        onProgress(100);
      }

      // Get file view URL
      const fileUrl = storage.getFileView(APPWRITE_BUCKET_ID, fileId);

      return {
        fileId: uploadedFile.$id,
        fileName: file.name,
        fileUrl: fileUrl.toString(),
        fileSize: file.size,
        mimeType: file.type,
      };
    } catch (error) {
      console.error("Error uploading file to Appwrite:", error);
      throw new Error("Failed to upload file");
    }
  }

  /**
   * Delete file from Appwrite storage
   */
  static async deleteFile(fileId: string): Promise<void> {
    try {
      await storage.deleteFile(APPWRITE_BUCKET_ID, fileId);
    } catch (error) {
      console.error("Error deleting file from Appwrite:", error);
      throw new Error("Failed to delete file");
    }
  }

  /**
   * Get file download URL from Appwrite
   */
  static getFileDownloadUrl(fileId: string): string {
    return storage.getFileDownload(APPWRITE_BUCKET_ID, fileId).toString();
  }

  /**
   * Get file view URL from Appwrite
   */
  static getFileViewUrl(fileId: string): string {
    return storage.getFileView(APPWRITE_BUCKET_ID, fileId).toString();
  }

  // =================== MEDICAL DOCUMENTS METHODS ===================

  /**
   * Create a new medical document with note and file
   */
  static async createDocument(
    patientId: string,
    clinicId: string,
    note: string,
    createdBy: string,
    file?: File,
  ): Promise<string> {
    try {
      let fileId: string | undefined;

      // Upload file to Appwrite if provided
      if (file) {
        const uploadResult = await this.uploadFile(file);

        fileId = uploadResult.fileId;
      }

      // Save document metadata to Firebase
      const docData = {
        patientId,
        clinicId,
        note,
        file: fileId,
        createdBy,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(
        collection(db, DOCUMENTS_COLLECTION),
        docData,
      );

      return docRef.id;
    } catch (error) {
      console.error("Error creating medical document:", error);
      throw new Error("Failed to create medical document");
    }
  }

  /**
   * Create a new medical document with note and file with progress callback
   */
  static async createDocumentWithProgress(
    patientId: string,
    clinicId: string,
    note: string,
    createdBy: string,
    file?: File,
    onProgress?: (progress: number) => void,
  ): Promise<string> {
    try {
      let fileId: string | undefined;

      // Upload file to Appwrite if provided
      if (file) {
        const uploadResult = await this.uploadFileWithProgress(
          file,
          onProgress,
        );

        fileId = uploadResult.fileId;
      }

      // Save document metadata to Firebase
      const docData = {
        patientId,
        clinicId,
        note,
        file: fileId,
        createdBy,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(
        collection(db, DOCUMENTS_COLLECTION),
        docData,
      );

      return docRef.id;
    } catch (error) {
      console.error("Error creating medical document:", error);
      throw new Error("Failed to create medical document");
    }
  }

  /**
   * Get all documents for a patient in a specific clinic
   */
  static async getDocumentsByPatient(
    patientId: string,
    clinicId: string,
  ): Promise<MedicalDocument[]> {
    try {
      if (!patientId || !clinicId) {
        console.error(
          "No patientId or clinicId provided to getDocumentsByPatient",
        );

        return [];
      }

      // Log current user for debugging
      const currentUser = auth.currentUser;

      console.log(
        "Fetching documents for patient:",
        patientId,
        "clinic:",
        clinicId,
        "User:",
        currentUser?.uid,
      );

      const q = query(
        collection(db, DOCUMENTS_COLLECTION),
        where("patientId", "==", patientId),

      );

      const querySnapshot = await getDocs(q);
      const documents = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as MedicalDocument[];

      // Sort in memory by creation date (newest first)
      documents.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      console.log(
        "Successfully fetched",
        documents.length,
        "documents for patient",
      );

      return documents;
    } catch (error) {
      console.error("Error getting documents by patient:", error);

      // Enhanced error logging
      if (error instanceof Error) {
        console.error("Error details:", {
          message: error.message,
          patientId,
          clinicId,
          userId: auth.currentUser?.uid || "not authenticated",
          userEmail: auth.currentUser?.email || "no email",
        });

        // Check if it's a permission error
        if (error.message.includes("Missing or insufficient permissions")) {
          console.error(
            "Permission denied - check Firestore rules and user authentication",
          );
        }
      }

      // Return empty array instead of throwing to prevent complete page failure
      return [];
    }
  }

  /**
   * Get all documents for a clinic
   */
  static async getDocumentsByClinic(
    clinicId: string,
  ): Promise<MedicalDocument[]> {
    try {
      const q = query(
        collection(db, DOCUMENTS_COLLECTION),

        orderBy("createdAt", "desc"),
      );

      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as MedicalDocument[];
    } catch (error) {
      console.error("Error getting documents by clinic:", error);
      throw new Error("Failed to get clinic documents");
    }
  }

  /**
   * Get document by ID
   */
  static async getDocumentById(
    documentId: string,
  ): Promise<MedicalDocument | null> {
    try {
      const docRef = doc(db, DOCUMENTS_COLLECTION, documentId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data(),
          createdAt: docSnap.data().createdAt?.toDate() || new Date(),
          updatedAt: docSnap.data().updatedAt?.toDate() || new Date(),
        } as MedicalDocument;
      }

      return null;
    } catch (error) {
      console.error("Error getting document by ID:", error);
      throw new Error("Failed to get document");
    }
  }

  /**
   * Update a medical document
   */
  static async updateDocument(
    documentId: string,
    note: string,
    newFile?: File,
  ): Promise<void> {
    try {
      const docRef = doc(db, DOCUMENTS_COLLECTION, documentId);

      let updateData: any = {
        note,
        updatedAt: serverTimestamp(),
      };

      // If a new file is provided, upload it and replace the old one
      if (newFile) {
        // Get the existing document to delete old file if it exists
        const existingDoc = await this.getDocumentById(documentId);

        if (existingDoc?.file) {
          await this.deleteFile(existingDoc.file);
        }

        // Upload new file
        const uploadResult = await this.uploadFile(newFile);

        updateData.file = uploadResult.fileId;
      }

      await updateDoc(docRef, updateData);
    } catch (error) {
      console.error("Error updating medical document:", error);
      throw new Error("Failed to update medical document");
    }
  }

  /**
   * Delete a medical document (includes file from Appwrite)
   */
  static async deleteDocument(documentId: string): Promise<void> {
    try {
      // Get document to access file ID
      const document = await this.getDocumentById(documentId);

      if (document?.file) {
        // Delete file from Appwrite
        await this.deleteFile(document.file);
      }

      // Delete document from Firebase
      const docRef = doc(db, DOCUMENTS_COLLECTION, documentId);

      await deleteDoc(docRef);
    } catch (error) {
      console.error("Error deleting medical document:", error);
      throw new Error("Failed to delete medical document");
    }
  }

  // =================== X-RAY RECORDS METHODS ===================

  /**
   * Create a new X-ray record with note and file
   */
  static async createXrayRecord(
    patientId: string,
    clinicId: string,
    note: string,
    createdBy: string,
    file?: File,
  ): Promise<string> {
    try {
      let fileId: string | undefined;

      // Upload file to Appwrite if provided
      if (file) {
        const uploadResult = await this.uploadFile(file);

        fileId = uploadResult.fileId;
      }

      // Save X-ray metadata to Firebase
      const xrayData = {
        patientId,
        clinicId,
        note,
        file: fileId,
        createdBy,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, XRAYS_COLLECTION), xrayData);

      return docRef.id;
    } catch (error) {
      console.error("Error creating X-ray record:", error);
      throw new Error("Failed to create X-ray record");
    }
  }

  /**
   * Create a new X-ray record with note and file with progress callback
   */
  static async createXrayRecordWithProgress(
    patientId: string,
    clinicId: string,
    note: string,
    createdBy: string,
    file?: File,
    onProgress?: (progress: number) => void,
  ): Promise<string> {
    try {
      let fileId: string | undefined;

      // Upload file to Appwrite if provided
      if (file) {
        const uploadResult = await this.uploadFileWithProgress(
          file,
          onProgress,
        );

        fileId = uploadResult.fileId;
      }

      // Save X-ray metadata to Firebase
      const xrayData = {
        patientId,
        clinicId,
        note,
        file: fileId,
        createdBy,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, XRAYS_COLLECTION), xrayData);

      return docRef.id;
    } catch (error) {
      console.error("Error creating X-ray record:", error);
      throw new Error("Failed to create X-ray record");
    }
  }

  /**
   * Get all X-ray records for a patient in a specific clinic
   */
  static async getXraysByPatient(
    patientId: string,
    clinicId: string,
  ): Promise<XrayRecord[]> {
    try {
      if (!patientId || !clinicId) {
        console.error("No patientId or clinicId provided to getXraysByPatient");

        return [];
      }

      // Log current user for debugging
      const currentUser = auth.currentUser;

      console.log(
        "Fetching X-rays for patient:",
        patientId,
        "clinic:",
        clinicId,
        "User:",
        currentUser?.uid,
      );

      const q = query(
        collection(db, XRAYS_COLLECTION),
        where("patientId", "==", patientId),

      );

      const querySnapshot = await getDocs(q);
      const xrays = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as XrayRecord[];

      // Sort in memory by creation date (newest first)
      xrays.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      console.log("Successfully fetched", xrays.length, "X-rays for patient");

      return xrays;
    } catch (error) {
      console.error("Error getting X-rays by patient:", error);

      // Enhanced error logging
      if (error instanceof Error) {
        console.error("Error details:", {
          message: error.message,
          patientId,
          clinicId,
          userId: auth.currentUser?.uid || "not authenticated",
          userEmail: auth.currentUser?.email || "no email",
        });

        // Check if it's a permission error
        if (error.message.includes("Missing or insufficient permissions")) {
          console.error(
            "Permission denied - check Firestore rules and user authentication",
          );
        }
      }

      // Return empty array instead of throwing to prevent complete page failure
      return [];
    }
  }

  /**
   * Get all X-ray records for a clinic
   */
  static async getXraysByClinic(clinicId: string): Promise<XrayRecord[]> {
    try {
      const q = query(
        collection(db, XRAYS_COLLECTION),

        orderBy("createdAt", "desc"),
      );

      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as XrayRecord[];
    } catch (error) {
      console.error("Error getting X-rays by clinic:", error);
      throw new Error("Failed to get clinic X-rays");
    }
  }

  /**
   * Get X-ray record by ID
   */
  static async getXrayById(xrayId: string): Promise<XrayRecord | null> {
    try {
      const docRef = doc(db, XRAYS_COLLECTION, xrayId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data(),
          createdAt: docSnap.data().createdAt?.toDate() || new Date(),
          updatedAt: docSnap.data().updatedAt?.toDate() || new Date(),
        } as XrayRecord;
      }

      return null;
    } catch (error) {
      console.error("Error getting X-ray by ID:", error);
      throw new Error("Failed to get X-ray record");
    }
  }

  /**
   * Update an X-ray record
   */
  static async updateXrayRecord(
    xrayId: string,
    note: string,
    newImageFile?: File,
  ): Promise<void> {
    try {
      const docRef = doc(db, XRAYS_COLLECTION, xrayId);

      let updateData: any = {
        note,
        updatedAt: serverTimestamp(),
      };

      // If a new image file is provided, upload it and replace the old one
      if (newImageFile) {
        // Get the existing X-ray record to delete old file if it exists
        const existingXray = await this.getXrayById(xrayId);

        if (existingXray?.file) {
          await this.deleteFile(existingXray.file);
        }

        // Upload new image file
        const uploadResult = await this.uploadFile(newImageFile);

        updateData.file = uploadResult.fileId;
      }

      await updateDoc(docRef, updateData);
    } catch (error) {
      console.error("Error updating X-ray record:", error);
      throw new Error("Failed to update X-ray record");
    }
  }

  /**
   * Delete an X-ray record (includes image from Appwrite)
   */
  static async deleteXrayRecord(xrayId: string): Promise<void> {
    try {
      // Get X-ray record to access image ID
      const xrayRecord = await this.getXrayById(xrayId);

      if (xrayRecord?.file) {
        // Delete image from Appwrite
        await this.deleteFile(xrayRecord.file);
      }

      // Delete X-ray record from Firebase
      const docRef = doc(db, XRAYS_COLLECTION, xrayId);

      await deleteDoc(docRef);
    } catch (error) {
      console.error("Error deleting X-ray record:", error);
      throw new Error("Failed to delete X-ray record");
    }
  }
}
