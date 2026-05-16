import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  getDoc,
  Timestamp,
  writeBatch,
} from "firebase/firestore";

import { db } from "@/config/firebase";
import { Prescription, PrescriptionItem } from "@/types/medical-records";

/**
 * Safely convert a Firestore field to a JavaScript Date object.
 * Handles Timestamps, Date objects, and strings.
 */
const safeToDate = (field: any): Date | undefined => {
  if (!field) return undefined;
  if (typeof field.toDate === "function") return field.toDate();
  if (field instanceof Date) return field;
  if (field.seconds !== undefined) return new Date(field.seconds * 1000);
  const d = new Date(field);
  return isNaN(d.getTime()) ? undefined : d;
};

export interface CreatePrescriptionData {
  patientId: string;
  clinicId: string;
  branchId: string;
  appointmentId?: string;
  doctorId: string;
  items: Array<{
    medicineId: string;
    medicineName: string;
    dosage: string;
    frequency: string;
    duration: string;
    time: string;
    instructions?: string;
    quantity?: number;
    sendToPharmacy?: boolean;
  }>;
  diagnosis?: string;
  notes?: string;
  prescribedBy: string;
  sendToPharmacy?: boolean;
}

export interface UpdatePrescriptionData {
  status?: "active" | "completed" | "cancelled";
  diagnosis?: string;
  notes?: string;
  items?: Array<{
    id?: string;
    medicineId: string;
    medicineName: string;
    dosage: string;
    frequency: string;
    duration: string;
    time: string;
    instructions?: string;
    quantity?: number;
    sendToPharmacy?: boolean;
  }>;
  sendToPharmacy?: boolean;
}

export const prescriptionService = {
  /**
   * Create a new prescription with optional appointment linking
   */
  async createPrescription(data: CreatePrescriptionData): Promise<string> {
    try {
      const prescriptionsCollection = collection(db, "prescriptions");

      // If appointment is linked, get appointment details for context
      let appointmentContext: { appointmentDate?: any; appointmentType?: any } =
        {};

      if (data.appointmentId) {
        try {
          const appointmentDoc = await getDoc(
            doc(db, "appointments", data.appointmentId),
          );

          if (appointmentDoc.exists()) {
            const appointmentData = appointmentDoc.data();

            // Only include defined values to avoid Firebase errors
            if (appointmentData.appointmentDate !== undefined) {
              appointmentContext.appointmentDate =
                appointmentData.appointmentDate;
            }
            if (appointmentData.appointmentType !== undefined) {
              appointmentContext.appointmentType =
                appointmentData.appointmentType;
            }
          }
        } catch (error) {
          console.warn("Could not fetch appointment details:", error);
        }
      }

      // Generate prescription number
      const prescriptionNo = `RX-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      // Create the main prescription document
      const prescriptionData = {
        prescriptionNo,
        patientId: data.patientId,
        clinicId: data.clinicId,
        branchId: data.branchId,
        doctorId: data.doctorId,
        appointmentId: data.appointmentId || null,
        prescriptionDate: Timestamp.now(),
        status: "active" as const,
        diagnosis: data.diagnosis || "",
        notes: data.notes || "",
        createdBy: data.prescribedBy,
        ...appointmentContext,
        sendToPharmacy: data.sendToPharmacy || false,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      const prescriptionRef = await addDoc(
        prescriptionsCollection,
        prescriptionData,
      );

      // Create prescription items as a sub-collection
      const prescriptionItemsCollection = collection(
        db,
        "prescriptions",
        prescriptionRef.id,
        "items",
      );

      const itemPromises = data.items.map((item) =>
        addDoc(prescriptionItemsCollection, {
          prescriptionId: prescriptionRef.id,
          medicineId: item.medicineId,
          medicineName: item.medicineName,
          dosage: item.dosage,
          frequency: item.frequency,
          duration: item.duration,
          time: item.time,
          instructions: item.instructions || "",
          quantity: item.quantity || 1,
          sendToPharmacy: item.sendToPharmacy || data.sendToPharmacy || false,
          isActive: true,
          createdBy: data.prescribedBy,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        }),
      );

      await Promise.all(itemPromises);

      return prescriptionRef.id;
    } catch (error) {
      console.error("Error creating prescription:", error);
      throw error;
    }
  },

  /**
   * Get all prescriptions (excluding deleted)
   */
  async getPrescriptions(): Promise<Prescription[]> {
    try {
      const prescriptionsCollection = collection(db, "prescriptions");
      const q = query(prescriptionsCollection, orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          prescriptionDate: safeToDate(data.prescriptionDate),
          appointmentDate: safeToDate(data.appointmentDate),
          createdAt: safeToDate(data.createdAt),
          updatedAt: safeToDate(data.updatedAt),
        };
      }) as Prescription[];
    } catch (error) {
      console.error("Error fetching prescriptions:", error);
      throw error;
    }
  },

  /**
   * Alias for backward compatibility
   */
  async getPrescriptionsByClinic(
    _clinicId?: string,
    branchId?: string,
  ): Promise<Prescription[]> {
    const prescriptions = await this.getPrescriptions();
    if (branchId) {
      return prescriptions.filter((p) => p.branchId === branchId);
    }
    return prescriptions;
  },

  /**
   * Get prescriptions by appointment
   */
  async getPrescriptionsByAppointment(
    appointmentId: string,
  ): Promise<Prescription[]> {
    try {
      const prescriptionsCollection = collection(db, "prescriptions");
      const q = query(
        prescriptionsCollection,
        where("appointmentId", "==", appointmentId),
      );

      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          prescriptionDate: safeToDate(data.prescriptionDate),
          appointmentDate: safeToDate(data.appointmentDate),
          createdAt: safeToDate(data.createdAt),
          updatedAt: safeToDate(data.updatedAt),
        };
      }) as Prescription[];
    } catch (error) {
      console.error("Error fetching prescriptions by appointment:", error);
      throw error;
    }
  },

  /**
   * Get prescriptions by patient
   */
  async getPrescriptionsByPatient(patientId: string): Promise<Prescription[]> {
    try {
      const prescriptionsCollection = collection(db, "prescriptions");
      const q = query(
        prescriptionsCollection,
        where("patientId", "==", patientId),
      );

      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          prescriptionDate: safeToDate(data.prescriptionDate),
          appointmentDate: safeToDate(data.appointmentDate),
          createdAt: safeToDate(data.createdAt),
          updatedAt: safeToDate(data.updatedAt),
        };
      }) as Prescription[];
    } catch (error) {
      console.error("Error fetching prescriptions by patient:", error);
      throw error;
    }
  },

  /**
   * Get a single prescription with its items
   */
  async getPrescriptionById(
    prescriptionId: string,
  ): Promise<Prescription | null> {
    try {
      const prescriptionDoc = await getDoc(
        doc(db, "prescriptions", prescriptionId),
      );

      if (!prescriptionDoc.exists()) {
        return null;
      }

      const prescriptionData = prescriptionDoc.data();

      return {
        id: prescriptionDoc.id,
        ...prescriptionData,
        prescriptionDate: safeToDate(prescriptionData.prescriptionDate),
        appointmentDate: safeToDate(prescriptionData.appointmentDate),
        createdAt: safeToDate(prescriptionData.createdAt),
        updatedAt: safeToDate(prescriptionData.updatedAt),
      } as unknown as Prescription;
    } catch (error) {
      console.error("Error fetching prescription:", error);
      throw error;
    }
  },

  /**
   * Get prescription items for a prescription
   */
  async getPrescriptionItems(
    prescriptionId: string,
  ): Promise<PrescriptionItem[]> {
    try {
      const itemsCollection = collection(
        db,
        "prescriptions",
        prescriptionId,
        "items",
      );
      const q = query(itemsCollection, orderBy("createdAt", "asc"));

      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: safeToDate(data.createdAt),
          updatedAt: safeToDate(data.updatedAt),
        };
      }) as PrescriptionItem[];
    } catch (error) {
      console.error("Error fetching prescription items:", error);
      throw error;
    }
  },

  /**
   * Update prescription main data
   */
  async updatePrescription(
    prescriptionId: string,
    data: UpdatePrescriptionData,
  ): Promise<void> {
    try {
      const prescriptionRef = doc(db, "prescriptions", prescriptionId);
      const updateData: any = {
        updatedAt: Timestamp.now(),
      };

      if (data.status !== undefined) {
        updateData.status = data.status;
      }
      if (data.diagnosis !== undefined) {
        updateData.diagnosis = data.diagnosis;
      }
      if (data.notes !== undefined) {
        updateData.notes = data.notes;
      }

      await updateDoc(prescriptionRef, updateData);
    } catch (error) {
      console.error("Error updating prescription:", error);
      throw error;
    }
  },

  /**
   * Update prescription items
   */
  async updatePrescriptionItems(
    prescriptionId: string,
    items: UpdatePrescriptionData["items"],
  ): Promise<void> {
    try {
      if (!items) return;

      const batch = writeBatch(db);
      const itemsCollection = collection(
        db,
        "prescriptions",
        prescriptionId,
        "items",
      );

      // Get existing items to determine which to delete
      const existingItems = await getDocs(itemsCollection);
      const existingItemIds = existingItems.docs.map((doc) => doc.id);

      // Process new/updated items
      const newItemIds: string[] = [];

      for (const item of items) {
        if (item.id) {
          // Update existing item
          const itemRef = doc(
            db,
            "prescriptions",
            prescriptionId,
            "items",
            item.id,
          );

          batch.update(itemRef, {
            medicineId: item.medicineId,
            medicineName: item.medicineName,
            dosage: item.dosage,
            frequency: item.frequency,
            duration: item.duration,
            time: item.time,
            instructions: item.instructions || "",
            quantity: item.quantity || 1,
            updatedAt: Timestamp.now(),
          });
          newItemIds.push(item.id);
        } else {
          // Create new item
          const itemRef = doc(itemsCollection);

          batch.set(itemRef, {
            prescriptionId,
            medicineId: item.medicineId,
            medicineName: item.medicineName,
            dosage: item.dosage,
            frequency: item.frequency,
            duration: item.duration,
            time: item.time,
            instructions: item.instructions || "",
            quantity: item.quantity || 1,
            isActive: true,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          });
          newItemIds.push(itemRef.id);
        }
      }

      // Delete items that are no longer present
      const itemsToDelete = existingItemIds.filter(
        (id) => !newItemIds.includes(id),
      );

      itemsToDelete.forEach((itemId) => {
        const itemRef = doc(
          db,
          "prescriptions",
          prescriptionId,
          "items",
          itemId,
        );

        batch.delete(itemRef);
      });

      await batch.commit();
    } catch (error) {
      console.error("Error updating prescription items:", error);
      throw error;
    }
  },

  /**
   * Delete prescription (with all its items)
   */
  async deletePrescription(prescriptionId: string): Promise<void> {
    try {
      const prescriptionRef = doc(db, "prescriptions", prescriptionId);

      // Delete all items in the sub-collection
      const itemsCollection = collection(
        db,
        "prescriptions",
        prescriptionId,
        "items",
      );
      const itemsSnapshot = await getDocs(itemsCollection);
      const deletePromises = itemsSnapshot.docs.map((itemDoc) =>
        deleteDoc(doc(itemsCollection, itemDoc.id)),
      );

      // Delete the prescription document
      await deleteDoc(prescriptionRef);

      await Promise.all(deletePromises);
    } catch (error) {
      console.error("Error deleting prescription:", error);
      throw error;
    }
  },
};
