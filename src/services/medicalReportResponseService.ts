import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  where,
  orderBy,
  deleteDoc,
  updateDoc,
} from "firebase/firestore";

import { db } from "@/config/firebase";
import { MedicalReportResponse } from "@/types/models";

const COLLECTION_NAME = "medicalReportResponses";

export class MedicalReportResponseService {
  /**
   * Save or update patient responses to medical report fields
   */
  static async savePatientResponses(
    clinicId: string,
    branchId: string,
    patientId: string,
    fieldValues: Record<string, any>,
    submittedBy: string,
  ): Promise<string> {
    try {
      const responsesRef = collection(db, "medical_report_responses");
      const now = new Date();

      const responseData: Omit<MedicalReportResponse, "id"> = {
        clinicId,
        branchId,
        patientId,
        fieldValues,
        submittedBy,
        submittedAt: now,
        updatedAt: now,
      };

      const docRef = doc(db, COLLECTION_NAME, `${clinicId}_${patientId}`);

      await setDoc(docRef, { ...responseData, id: docRef.id }, { merge: true });

      return docRef.id;
    } catch (error) {
      console.error("Error saving patient responses:", error);
      throw new Error("Failed to save patient responses");
    }
  }

  /**
   * Get patient responses for medical report
   */
  static async getPatientResponses(
    clinicId: string,
    patientId: string,
  ): Promise<MedicalReportResponse | null> {
    try {
      // Use a query instead of direct document access to avoid permission issues with non-existent docs
      const q = query(
        collection(db, COLLECTION_NAME),

        where("patientId", "==", patientId),
      );

      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];

        return doc.data() as MedicalReportResponse;
      }

      // No document found, return null (this is normal for new patients)
      return null;
    } catch (error) {
      console.error("Error getting patient responses:", error);
      console.error("Error details:", {
        code: (error as any)?.code,
        message: (error as any)?.message,
        clinicId,
        patientId,
      });

      // If it's a permission error, return null (might be first time accessing)
      if ((error as any)?.code === "permission-denied") {
        console.warn("Permission denied - returning null for new patient");

        return null;
      }

      throw new Error("Failed to get patient responses");
    }
  }

  /**
   * Get all patient responses for a clinic (for reporting purposes)
   */
  static async getClinicPatientResponses(
    clinicId: string,
  ): Promise<MedicalReportResponse[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),

        orderBy("updatedAt", "desc"),
      );

      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map(
        (doc) => doc.data() as MedicalReportResponse,
      );
    } catch (error) {
      console.error("Error getting clinic patient responses:", error);
      throw new Error("Failed to get clinic patient responses");
    }
  }

  /**
   * Delete patient responses
   */
  static async deletePatientResponses(
    clinicId: string,
    patientId: string,
  ): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, `${clinicId}_${patientId}`);

      await deleteDoc(docRef);
    } catch (error) {
      console.error("Error deleting patient responses:", error);
      throw new Error("Failed to delete patient responses");
    }
  }

  /**
   * Update specific field response
   */
  static async updateFieldResponse(
    clinicId: string,
    patientId: string,
    fieldKey: string,
    value: any,
    updatedBy: string,
  ): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, `${clinicId}_${patientId}`);

      await updateDoc(docRef, {
        [`fieldValues.${fieldKey}`]: value,
        updatedBy,
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error("Error updating field response:", error);
      throw new Error("Failed to update field response");
    }
  }

  /**
   * Check if patient has any responses
   */
  static async hasPatientResponses(
    clinicId: string,
    patientId: string,
  ): Promise<boolean> {
    try {
      const response = await this.getPatientResponses(clinicId, patientId);

      return (
        response !== null && Object.keys(response.fieldValues || {}).length > 0
      );
    } catch (error) {
      console.error("Error checking patient responses:", error);

      return false;
    }
  }

  /**
   * Get response statistics for a clinic
   */
  static async getResponseStatistics(clinicId: string): Promise<{
    totalPatients: number;
    patientsWithResponses: number;
    completionRate: number;
    lastUpdated?: Date;
  }> {
    try {
      const responses = await this.getClinicPatientResponses(clinicId);
      const totalPatients = responses.length;
      const patientsWithResponses = responses.filter(
        (r) => r.fieldValues && Object.keys(r.fieldValues).length > 0,
      ).length;

      const lastUpdated =
        responses.length > 0
          ? responses.reduce(
              (latest, response) =>
                response.updatedAt > latest ? response.updatedAt : latest,
              responses[0].updatedAt,
            )
          : undefined;

      return {
        totalPatients,
        patientsWithResponses,
        completionRate:
          totalPatients > 0 ? (patientsWithResponses / totalPatients) * 100 : 0,
        lastUpdated,
      };
    } catch (error) {
      console.error("Error getting response statistics:", error);
      throw new Error("Failed to get response statistics");
    }
  }
}
