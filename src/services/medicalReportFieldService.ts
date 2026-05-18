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
  Timestamp,
} from "firebase/firestore";

import { db } from "@/config/firebase";
import { MedicalReportField } from "@/types/models";

const COLLECTION_NAME = "medical_report_fields";

export const medicalReportFieldService = {
  // Create a new medical report field
  async createField(
    fieldData: Omit<MedicalReportField, "id" | "createdAt" | "updatedAt">,
  ): Promise<string> {
    try {
      const docData = {
        ...fieldData,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      const docRef = await addDoc(collection(db, COLLECTION_NAME), docData);

      return docRef.id;
    } catch (error) {
      console.error("Error creating medical report field:", error);
      throw error;
    }
  },

  // Get all fields for a clinic (alias for getFieldsByClinic)
  async getFields(clinicId: string): Promise<MedicalReportField[]> {
    return this.getFieldsByClinic(clinicId);
  },

  // Get all fields for a clinic
  async getFieldsByClinic(clinicId: string): Promise<MedicalReportField[]> {
    try {
      // Simplify query to avoid composite index requirement
      const q = query(
        collection(db, COLLECTION_NAME),
        where("clinicId", "==", clinicId),
      );

      const querySnapshot = await getDocs(q);

      let fields = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as MedicalReportField[];

      // Self-healing auto-seeder if no fields exist yet
      if (fields.length === 0) {
        console.log("No medical report fields found, running self-healing auto-seeder...");
        const defaultFields: Omit<MedicalReportField, "id" | "createdAt" | "updatedAt">[] = [
          {
            clinicId,
            branchId: "",
            createdBy: "system",
            fieldKey: "chief-complaint",
            fieldLabel: "Chief Complaint",
            fieldType: "textarea",
            isRequired: true,
            placeholder: "Describe the primary reason for the patient visit...",
            displayOrder: 1,
            isActive: true
          },
          {
            clinicId,
            branchId: "",
            createdBy: "system",
            fieldKey: "past-medical-history",
            fieldLabel: "Past Medical History",
            fieldType: "textarea",
            isRequired: false,
            placeholder: "List any relevant medical conditions, past surgeries, etc.",
            displayOrder: 2,
            isActive: true
          },
          {
            clinicId,
            branchId: "",
            createdBy: "system",
            fieldKey: "blood-group",
            fieldLabel: "Blood Group",
            fieldType: "select",
            options: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
            isRequired: false,
            placeholder: "Select blood type",
            displayOrder: 3,
            isActive: true
          },
          {
            clinicId,
            branchId: "",
            createdBy: "system",
            fieldKey: "known-allergies",
            fieldLabel: "Known Allergies",
            fieldType: "text",
            isRequired: false,
            placeholder: "List allergies (e.g. Penicillin, Pollen) or 'None'",
            displayOrder: 4,
            isActive: true
          },
          {
            clinicId,
            branchId: "",
            createdBy: "system",
            fieldKey: "smoker-lifestyle",
            fieldLabel: "Tobacco/Smoking Status",
            fieldType: "yes-no",
            isRequired: false,
            displayOrder: 5,
            isActive: true
          },
          {
            clinicId,
            branchId: "",
            createdBy: "system",
            fieldKey: "family-medical-history",
            fieldLabel: "Family Medical History",
            fieldType: "textarea",
            isRequired: false,
            placeholder: "Describe hereditary illnesses (e.g. hypertension, diabetes)...",
            displayOrder: 6,
            isActive: true
          }
        ];

        const promises = defaultFields.map(field => this.createField(field));
        await Promise.all(promises);

        const reSnapshot = await getDocs(q);
        fields = reSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date(),
          updatedAt: doc.data().updatedAt?.toDate() || new Date(),
        })) as MedicalReportField[];
      }

      // Sort in memory to avoid index errors
      return fields.sort((a, b) => {
        const orderA = a.displayOrder ?? 0;
        const orderB = b.displayOrder ?? 0;
        if (orderA !== orderB) return orderA - orderB;
        // Secondary sort by createdAt desc
        return b.createdAt.getTime() - a.createdAt.getTime();
      });
    } catch (error) {
      console.error("Error getting medical report fields:", error);
      throw error;
    }
  },

  // Get active fields for a clinic
  async getActiveFieldsByClinic(
    clinicId: string,
  ): Promise<MedicalReportField[]> {
    try {
      const fields = await this.getFieldsByClinic(clinicId);
      return fields
        .filter((f) => f.isActive)
        .sort((a, b) => {
          const orderA = a.displayOrder ?? 0;
          const orderB = b.displayOrder ?? 0;
          return orderA - orderB;
        });
    } catch (error) {
      console.error("Error getting active medical report fields:", error);
      throw error;
    }
  },

  // Get a field by ID
  async getFieldById(fieldId: string): Promise<MedicalReportField | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, fieldId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data(),
          createdAt: docSnap.data().createdAt?.toDate() || new Date(),
          updatedAt: docSnap.data().updatedAt?.toDate() || new Date(),
        } as MedicalReportField;
      }

      return null;
    } catch (error) {
      console.error("Error getting medical report field:", error);
      throw error;
    }
  },

  // Update a field
  async updateField(
    fieldId: string,
    updateData: Partial<MedicalReportField>,
  ): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, fieldId);
      const dataToUpdate = {
        ...updateData,
        updatedAt: Timestamp.now(),
      };

      await updateDoc(docRef, dataToUpdate);
    } catch (error) {
      console.error("Error updating medical report field:", error);
      throw error;
    }
  },

  // Delete a field
  async deleteField(fieldId: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, fieldId);

      await deleteDoc(docRef);
    } catch (error) {
      console.error("Error deleting medical report field:", error);
      throw error;
    }
  },

  // Check if a key is unique (alias for !isKeyExists)
  async isKeyUnique(
    clinicId: string,
    key: string,
    excludeFieldId?: string,
  ): Promise<boolean> {
    return !(await this.isKeyExists(clinicId, key, excludeFieldId));
  },

  // Check if a key exists in the clinic
  async isKeyExists(
    clinicId: string,
    key: string,
    excludeFieldId?: string,
  ): Promise<boolean> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where("clinicId", "==", clinicId),
        where("fieldKey", "==", key),
      );

      const querySnapshot = await getDocs(q);

      // If excludeFieldId is provided, check if any doc id matches it
      if (excludeFieldId && querySnapshot.docs.length === 1) {
        return querySnapshot.docs[0].id !== excludeFieldId;
      }

      return querySnapshot.docs.length > 0;
    } catch (error) {
      console.error("Error checking if key exists:", error);
      throw error;
    }
  },

  // Update field order (single field)
  async updateFieldOrder(fieldId: string, newOrder: number): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, fieldId);

      await updateDoc(docRef, {
        displayOrder: newOrder,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error("Error updating field order:", error);
      throw error;
    }
  },

  // Update field orders (multiple fields)
  async updateFieldOrders(
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
      console.error("Error updating field orders:", error);
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
