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
  Timestamp,
} from "firebase/firestore";

import { db } from "@/config/firebase";
import { NotesSection } from "@/types/models";

const COLLECTION_NAME = "notes_sections";

export const notesSectionService = {
  // Create a new notes section
  async createSection(
    sectionData: Omit<NotesSection, "id" | "createdAt" | "updatedAt">,
  ): Promise<string> {
    try {
      const docData = {
        ...sectionData,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      const docRef = await addDoc(collection(db, COLLECTION_NAME), docData);

      return docRef.id;
    } catch (error) {
      console.error("Error creating notes section:", error);
      throw error;
    }
  },

  // Get all sections for a clinic (alias for getSectionsByClinic)
  async getSections(clinicId: string): Promise<NotesSection[]> {
    return this.getSectionsByClinic(clinicId);
  },

  // Get all sections for a clinic
  async getSectionsByClinic(clinicId: string): Promise<NotesSection[]> {
    try {
      // Simplify query to avoid composite index requirement
      const q = query(
        collection(db, COLLECTION_NAME),

      );

      const querySnapshot = await getDocs(q);

      const sections = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as NotesSection[];

      // Sort in memory to avoid index errors
      return sections.sort((a, b) => {
        const orderA = a.displayOrder ?? 0;
        const orderB = b.displayOrder ?? 0;

        if (orderA !== orderB) return orderA - orderB;

        // Secondary sort by createdAt desc
        return b.createdAt.getTime() - a.createdAt.getTime();
      });
    } catch (error) {
      console.error("Error getting notes sections:", error);
      throw error;
    }
  },

  // Get active sections for a clinic (with self-healing default seeding)
  async getActiveSectionsByClinic(clinicId: string): Promise<NotesSection[]> {
    try {
      // Simplify query to avoid composite index requirement
      const q = query(
        collection(db, COLLECTION_NAME),

      );

      const querySnapshot = await getDocs(q);

      let sections = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as NotesSection[];

      // Self-healing: If no notes sections are configured for this clinic, auto-seed standard default sections
      if (sections.length === 0) {
        console.log(
          `[notesSectionService] Seeding default notes sections for clinic: ${clinicId}`,
        );
        const defaultSections = [
          {
            clinicId,
            branchId: "",
            sectionKey: "triage-vitals",
            sectionLabel: "Triage Vitals",
            description:
              "BP, Heart Rate, Temperature, Respiratory Rate, Oxygen Saturation (SpO2), Weight & Height.",
            isActive: true,
            displayOrder: 1,
            createdBy: "system",
          },
          {
            clinicId,
            branchId: "",
            sectionKey: "nursing-observations",
            sectionLabel: "Nursing Observations",
            description:
              "Recorded physical status, pain levels, active complaints, and triage priority.",
            isActive: true,
            displayOrder: 2,
            createdBy: "system",
          },
          {
            clinicId,
            branchId: "",
            sectionKey: "progress-notes",
            sectionLabel: "Progress Notes",
            description:
              "General nurse ward updates, chief complaints timeline, and hourly ward notes.",
            isActive: true,
            displayOrder: 3,
            createdBy: "system",
          },
        ];

        const seededList: NotesSection[] = [];

        for (const defaultSect of defaultSections) {
          const docData = {
            ...defaultSect,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          };
          const docRef = await addDoc(collection(db, COLLECTION_NAME), docData);

          seededList.push({
            id: docRef.id,
            ...defaultSect,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }

        return seededList;
      }

      // Filter and sort in memory
      return sections
        .filter((s) => s.isActive)
        .sort((a, b) => {
          const orderA = a.displayOrder ?? 0;
          const orderB = b.displayOrder ?? 0;

          return orderA - orderB;
        });
    } catch (error) {
      console.error("Error getting active notes sections:", error);
      throw error;
    }
  },

  // Get a section by ID
  async getSectionById(sectionId: string): Promise<NotesSection | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, sectionId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data(),
          createdAt: docSnap.data().createdAt?.toDate() || new Date(),
          updatedAt: docSnap.data().updatedAt?.toDate() || new Date(),
        } as NotesSection;
      }

      return null;
    } catch (error) {
      console.error("Error getting notes section:", error);
      throw error;
    }
  },

  // Update a section
  async updateSection(
    sectionId: string,
    updateData: Partial<NotesSection>,
  ): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, sectionId);
      const dataToUpdate = {
        ...updateData,
        updatedAt: Timestamp.now(),
      };

      await updateDoc(docRef, dataToUpdate);
    } catch (error) {
      console.error("Error updating notes section:", error);
      throw error;
    }
  },

  // Delete a section
  async deleteSection(sectionId: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, sectionId);

      await deleteDoc(docRef);
    } catch (error) {
      console.error("Error deleting notes section:", error);
      throw error;
    }
  },

  // Check if a key is unique (alias for !isKeyExists)
  async isKeyUnique(
    clinicId: string,
    key: string,
    excludeSectionId?: string,
  ): Promise<boolean> {
    return !(await this.isKeyExists(clinicId, key, excludeSectionId));
  },

  // Check if a key exists in the clinic
  async isKeyExists(
    clinicId: string,
    key: string,
    excludeSectionId?: string,
  ): Promise<boolean> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),

        where("sectionKey", "==", key),
      );

      const querySnapshot = await getDocs(q);

      // If excludeSectionId is provided, check if any doc id matches it
      if (excludeSectionId && querySnapshot.docs.length === 1) {
        return querySnapshot.docs[0].id !== excludeSectionId;
      }

      return querySnapshot.docs.length > 0;
    } catch (error) {
      console.error("Error checking if key exists:", error);
      throw error;
    }
  },

  // Update section order (single section)
  async updateSectionOrder(sectionId: string, newOrder: number): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, sectionId);

      await updateDoc(docRef, {
        displayOrder: newOrder,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error("Error updating section order:", error);
      throw error;
    }
  },

  // Update section orders (multiple sections)
  async updateSectionOrders(
    updates: { id: string; order: number }[],
  ): Promise<void> {
    try {
      const promises = updates.map((update) => {
        const docRef = doc(db, COLLECTION_NAME, update.id);

        return updateDoc(docRef, {
          displayOrder: update.order,
          updatedAt: Timestamp.now(),
        });
      });

      await Promise.all(promises);
    } catch (error) {
      console.error("Error updating section orders:", error);
      throw error;
    }
  },

  // Generate key from name
  generateKeyFromName(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s]/g, "") // Remove special characters
      .replace(/\s+/g, "-") // Replace spaces with hyphens
      .replace(/-+/g, "-") // Replace multiple hyphens with single
      .replace(/^-|-$/g, ""); // Remove leading/trailing hyphens
  },
};
