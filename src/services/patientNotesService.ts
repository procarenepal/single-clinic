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
  getDoc,
} from "firebase/firestore";

import { db } from "@/config/firebase";
import { PatientNotes } from "@/types/models";

const COLLECTION_NAME = "patientNotes";

export class PatientNotesService {
  /**
   * Save or update patient notes
   */
  static async savePatientNotes(
    clinicId: string,
    branchId: string,
    patientId: string,
    sectionValues: Record<string, string>,
    modifiedBy: string,
  ): Promise<void> {
    try {
      const existingNotes = await this.getPatientNotes(clinicId, patientId);

      const notesData: PatientNotes = {
        id: `${clinicId}_${patientId}`,
        clinicId,
        branchId,
        patientId,
        sectionValues,
        lastModifiedBy: modifiedBy,
        lastModifiedAt: new Date(),
        createdAt: existingNotes?.createdAt || new Date(),
      };

      const docRef = doc(db, COLLECTION_NAME, notesData.id);

      await setDoc(docRef, notesData, { merge: true });
    } catch (error) {
      console.error("Error saving patient notes:", error);
      throw new Error("Failed to save patient notes");
    }
  }

  /**
   * Get patient notes
   */
  static async getPatientNotes(
    clinicId: string,
    patientId: string,
  ): Promise<PatientNotes | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, `${clinicId}_${patientId}`);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();

        return {
          id: docSnap.id,
          ...data,
          lastModifiedAt: data.lastModifiedAt?.toDate() || new Date(),
          createdAt: data.createdAt?.toDate() || new Date(),
        } as PatientNotes;
      }

      return null;
    } catch (error) {
      console.error("Error getting patient notes:", error);
      throw new Error("Failed to get patient notes");
    }
  }

  /**
   * Get all patient notes for a clinic (for reporting purposes)
   */
  static async getClinicPatientNotes(
    clinicId: string,
  ): Promise<PatientNotes[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),

        orderBy("lastModifiedAt", "desc"),
      );

      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((doc) => {
        const data = doc.data();

        return {
          id: doc.id,
          ...data,
          lastModifiedAt: data.lastModifiedAt?.toDate() || new Date(),
          createdAt: data.createdAt?.toDate() || new Date(),
        } as PatientNotes;
      });
    } catch (error) {
      console.error("Error getting clinic patient notes:", error);
      throw new Error("Failed to get clinic patient notes");
    }
  }

  /**
   * Delete patient notes
   */
  static async deletePatientNotes(
    clinicId: string,
    patientId: string,
  ): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, `${clinicId}_${patientId}`);

      await deleteDoc(docRef);
    } catch (error) {
      console.error("Error deleting patient notes:", error);
      throw new Error("Failed to delete patient notes");
    }
  }

  /**
   * Update specific section note
   */
  static async updateSectionNote(
    clinicId: string,
    patientId: string,
    sectionKey: string,
    content: string,
    modifiedBy: string,
  ): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, `${clinicId}_${patientId}`);

      await updateDoc(docRef, {
        [`sectionValues.${sectionKey}`]: content,
        lastModifiedBy: modifiedBy,
        lastModifiedAt: new Date(),
      });
    } catch (error) {
      console.error("Error updating section note:", error);
      throw new Error("Failed to update section note");
    }
  }

  /**
   * Get notes for multiple patients (for bulk operations)
   */
  static async getMultiplePatientNotes(
    clinicId: string,
    patientIds: string[],
  ): Promise<PatientNotes[]> {
    try {
      const promises = patientIds.map((patientId) =>
        this.getPatientNotes(clinicId, patientId),
      );

      const results = await Promise.all(promises);

      return results.filter((notes) => notes !== null) as PatientNotes[];
    } catch (error) {
      console.error("Error getting multiple patient notes:", error);
      throw new Error("Failed to get multiple patient notes");
    }
  }
}
