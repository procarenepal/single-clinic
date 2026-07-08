import {
  collection,
  doc,
  addDoc,
  getDocs,
  query,
  where,
  deleteDoc,
  updateDoc,
  Timestamp,
} from "firebase/firestore";

import { db } from "@/config/firebase";
import { PatientNoteEntry } from "@/types/models";

const COLLECTION_NAME = "patientNoteEntries";

export class PatientNoteEntriesService {
  /**
   * Save a new patient note entry
   */
  static async saveNoteEntry(
    clinicId: string,
    patientId: string,
    sectionKey: string,
    sectionLabel: string,
    content: string,
    createdBy: string,
  ): Promise<string> {
    try {
      // Only save if content is not empty
      if (!content.trim()) {
        throw new Error("Note content cannot be empty");
      }

      const noteEntry = {
        clinicId,
        patientId,
        sectionKey,
        sectionLabel,
        content: content.trim(),
        createdBy,
        createdAt: Timestamp.now(),
      };

      const docRef = await addDoc(collection(db, COLLECTION_NAME), noteEntry);

      return docRef.id;
    } catch (error) {
      console.error("Error saving note entry:", error);
      throw new Error("Failed to save note entry");
    }
  }

  /**
   * Get all note entries for a patient
   */
  static async getPatientNoteEntries(
    clinicId: string,
    patientId: string,
  ): Promise<PatientNoteEntry[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),

        where("patientId", "==", patientId),
      );

      const querySnapshot = await getDocs(q);

      const entries = querySnapshot.docs.map((doc) => {
        const data = doc.data();

        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
        } as PatientNoteEntry;
      });

      // Sort by createdAt descending in memory to avoid index error
      return entries.sort((a, b) => {
        const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
        const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;

        return dateB - dateA;
      });
    } catch (error) {
      console.error("Error getting patient note entries:", error);
      throw new Error("Failed to get patient note entries");
    }
  }

  /**
   * Get note entries for a specific section
   */
  static async getSectionNoteEntries(
    clinicId: string,
    patientId: string,
    sectionKey: string,
  ): Promise<PatientNoteEntry[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),

        where("patientId", "==", patientId),
        where("sectionKey", "==", sectionKey),
      );

      const querySnapshot = await getDocs(q);

      const entries = querySnapshot.docs.map((doc) => {
        const data = doc.data();

        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
        } as PatientNoteEntry;
      });

      // Sort by createdAt descending in memory to avoid index error
      return entries.sort((a, b) => {
        const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
        const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;

        return dateB - dateA;
      });
    } catch (error) {
      console.error("Error getting section note entries:", error);
      throw new Error("Failed to get section note entries");
    }
  }

  /**
   * Update an existing note entry
   */
  static async updateNoteEntry(
    entryId: string,
    content: string,
  ): Promise<void> {
    try {
      // Only update if content is not empty
      if (!content.trim()) {
        throw new Error("Note content cannot be empty");
      }

      const docRef = doc(db, COLLECTION_NAME, entryId);

      await updateDoc(docRef, {
        content: content.trim(),
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error("Error updating note entry:", error);
      throw new Error("Failed to update note entry");
    }
  }

  /**
   * Delete a note entry
   */
  static async deleteNoteEntry(entryId: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, entryId);

      await deleteDoc(docRef);
    } catch (error) {
      console.error("Error deleting note entry:", error);
      throw new Error("Failed to delete note entry");
    }
  }

  /**
   * Get all note entries for a clinic (for reporting purposes)
   */
  static async getClinicNoteEntries(
    clinicId: string,
  ): Promise<PatientNoteEntry[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),

      );

      const querySnapshot = await getDocs(q);

      const entries = querySnapshot.docs.map((doc) => {
        const data = doc.data();

        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
        } as PatientNoteEntry;
      });

      // Sort by createdAt descending in memory to avoid index error
      return entries.sort((a, b) => {
        const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
        const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;

        return dateB - dateA;
      });
    } catch (error) {
      console.error("Error getting clinic note entries:", error);
      throw new Error("Failed to get clinic note entries");
    }
  }
}
