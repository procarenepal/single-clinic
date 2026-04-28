import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  Timestamp,
  QueryConstraint,
} from "firebase/firestore";

import { db } from "@/config/firebase";
import { Enquiry, EnquiryStatus } from "@/types/models";

const ENQUIRIES_COLLECTION = "enquiries";

function normalizeEnquiryStatus(input: unknown): EnquiryStatus {
  const raw = String(input ?? "")
    .trim()
    .toLowerCase();

  // Accept both old display labels and any future alternate labels (backward/forward compatibility)
  if (raw === "scheduled" || raw === "technician") return "scheduled";
  if (raw === "converted" || raw === "done") return "converted";

  if (raw === "new") return "new";
  if (raw === "contacted") return "contacted";
  if (raw === "closed") return "closed";

  // Fallback to 'new' to avoid breaking UI if unexpected values exist in old data
  return "new";
}

export interface EnquiryFilters {
  status?: EnquiryStatus | "all";
  startDate?: Date;
  endDate?: Date;
  branchId?: string;
  dateField?: "appointmentDate" | "createdAt";
}

export const enquiryService = {
  async createEnquiry(
    enquiryData: Omit<Enquiry, "id" | "createdAt" | "updatedAt">,
  ): Promise<string> {
    try {
      const enquiriesRef = collection(db, ENQUIRIES_COLLECTION);
      const payload: Record<string, any> = {
        ...enquiryData,
        status: normalizeEnquiryStatus(enquiryData.status ?? "new"),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (enquiryData.appointmentDate) {
        payload.appointmentDate = Timestamp.fromDate(
          enquiryData.appointmentDate,
        );
      }

      if (enquiryData.lastContactedAt instanceof Date) {
        payload.lastContactedAt = Timestamp.fromDate(
          enquiryData.lastContactedAt,
        );
      }

      if (enquiryData.nextContactAt instanceof Date) {
        payload.nextContactAt = Timestamp.fromDate(enquiryData.nextContactAt);
      }

      Object.keys(payload).forEach((key) => {
        if (payload[key] === undefined) {
          delete payload[key];
        }
      });

      const docRef = await addDoc(enquiriesRef, payload);

      return docRef.id;
    } catch (error) {
      console.error("Error creating enquiry:", error);
      throw error;
    }
  },

  async getEnquiries(
    _clinicId?: string,
    _branchId?: string,
    filters?: EnquiryFilters,
  ): Promise<Enquiry[]> {
    try {
      const constraints: QueryConstraint[] = [];

      // Branch filter removed for standalone mode

      const rangeField = filters?.dateField ?? "appointmentDate";
      let orderConstraint: QueryConstraint = orderBy("createdAt", "desc");

      const requestedStatus =
        filters?.status && filters.status !== "all"
          ? normalizeEnquiryStatus(filters.status)
          : undefined;

      // Always filter client-side to avoid requiring composite indexes for status + createdAt
      const shouldFilterClientSide = true;

      if (requestedStatus && !shouldFilterClientSide) {
        constraints.push(where("status", "==", requestedStatus));
      }

      if (filters?.startDate || filters?.endDate) {
        // Firestore requires orderBy on the same field used for range filters
        orderConstraint = orderBy(rangeField, "asc");
        if (filters.startDate) {
          constraints.push(
            where(rangeField, ">=", Timestamp.fromDate(filters.startDate)),
          );
        }
        if (filters.endDate) {
          constraints.push(
            where(rangeField, "<", Timestamp.fromDate(filters.endDate)),
          );
        }
      }

      const q = query(
        collection(db, ENQUIRIES_COLLECTION),
        ...constraints,
        orderConstraint,
      );
      const snapshot = await getDocs(q);

      const mapped = snapshot.docs.map((docSnap) => {
        const data = docSnap.data() as any;

        return {
          id: docSnap.id,
          ...data,
          status: normalizeEnquiryStatus(data.status),
          appointmentDate: data.appointmentDate?.toDate
            ? data.appointmentDate.toDate()
            : undefined,
          lastContactedAt: data.lastContactedAt?.toDate
            ? data.lastContactedAt.toDate()
            : undefined,
          nextContactAt: data.nextContactAt?.toDate
            ? data.nextContactAt.toDate()
            : undefined,
          createdAt: data.createdAt?.toDate
            ? data.createdAt.toDate()
            : new Date(),
          updatedAt: data.updatedAt?.toDate
            ? data.updatedAt.toDate()
            : new Date(),
        } as Enquiry;
      });

      if (requestedStatus && shouldFilterClientSide) {
        return mapped.filter((e) => e.status === requestedStatus);
      }

      return mapped;
    } catch (error) {
      console.error("Error fetching enquiries:", error);
      throw error;
    }
  },

  async updateEnquiry(
    enquiryId: string,
    updateData: Partial<Omit<Enquiry, "id">>,
  ): Promise<void> {
    try {
      const docRef = doc(db, ENQUIRIES_COLLECTION, enquiryId);
      const payload: Record<string, any> = {
        ...updateData,
        status:
          updateData.status === undefined
            ? undefined
            : normalizeEnquiryStatus(updateData.status),
        updatedAt: serverTimestamp(),
      };

      if (payload.appointmentDate instanceof Date) {
        payload.appointmentDate = Timestamp.fromDate(payload.appointmentDate);
      }

      if (payload.lastContactedAt instanceof Date) {
        payload.lastContactedAt = Timestamp.fromDate(payload.lastContactedAt);
      }

      if (payload.nextContactAt instanceof Date) {
        payload.nextContactAt = Timestamp.fromDate(payload.nextContactAt);
      }

      Object.keys(payload).forEach((key) => {
        if (payload[key] === undefined) {
          delete payload[key];
        }
      });

      await updateDoc(docRef, payload);
    } catch (error) {
      console.error("Error updating enquiry:", error);
      throw error;
    }
  },

  async updateEnquiryStatus(
    enquiryId: string,
    status: EnquiryStatus,
  ): Promise<void> {
    try {
      const docRef = doc(db, ENQUIRIES_COLLECTION, enquiryId);

      await updateDoc(docRef, {
        status: normalizeEnquiryStatus(status),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error updating enquiry status:", error);
      throw error;
    }
  },

  async deleteEnquiry(enquiryId: string): Promise<void> {
    try {
      const docRef = doc(db, ENQUIRIES_COLLECTION, enquiryId);

      await deleteDoc(docRef);
    } catch (error) {
      console.error("Error deleting enquiry:", error);
      throw error;
    }
  },
};
