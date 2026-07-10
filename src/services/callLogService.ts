import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
} from "firebase/firestore";

import { db } from "@/config/firebase";
import { CallLog } from "@/types/models";

const COLLECTION_NAME = "callLogs";

export const callLogService = {
  // Create a new call log entry
  async createCallLog(
    clinicId: string,
    callLogData: Omit<CallLog, "id" | "clinicId" | "createdAt" | "updatedAt">,
  ): Promise<CallLog> {
    try {
      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...callLogData,
        clinicId,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      return {
        id: docRef.id,
        ...callLogData,
        clinicId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } catch (error) {
      console.error("Error creating call log:", error);
      throw new Error("Failed to create call log entry");
    }
  },

  // Get all call logs for a clinic
  async getCallLogsByClinic(clinicId: string): Promise<CallLog[]> {
    try {
      const q = query(collection(db, COLLECTION_NAME));

      const querySnapshot = await getDocs(q);
      const callLogs: CallLog[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();

        callLogs.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          receivedOn: data.receivedOn?.toDate() || new Date(),
        } as CallLog);
      });

      return callLogs.sort(
        (a, b) => b.receivedOn.getTime() - a.receivedOn.getTime(),
      );
    } catch (error) {
      console.error("Error fetching call logs:", error);
      throw new Error("Failed to fetch call logs");
    }
  },

  // Get call log by ID
  async getCallLogById(callLogId: string): Promise<CallLog | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, callLogId);
      const docSnap = await getDocs(
        query(
          collection(db, COLLECTION_NAME),
          where("__name__", "==", callLogId),
        ),
      );

      if (docSnap.empty) {
        return null;
      }

      const data = docSnap.docs[0].data();

      return {
        id: docSnap.docs[0].id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
        receivedOn: data.receivedOn?.toDate() || new Date(),
      } as CallLog;
    } catch (error) {
      console.error("Error fetching call log:", error);
      throw new Error("Failed to fetch call log");
    }
  },

  // Update a call log entry
  async updateCallLog(
    callLogId: string,
    updates: Partial<
      Omit<CallLog, "id" | "clinicId" | "createdAt" | "updatedAt">
    >,
  ): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, callLogId);

      await updateDoc(docRef, {
        ...updates,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error("Error updating call log:", error);
      throw new Error("Failed to update call log");
    }
  },

  // Delete a call log entry
  async deleteCallLog(callLogId: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, callLogId);

      await deleteDoc(docRef);
    } catch (error) {
      console.error("Error deleting call log:", error);
      throw new Error("Failed to delete call log");
    }
  },

  // Get call logs by date range
  async getCallLogsByDateRange(
    clinicId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<CallLog[]> {
    try {
      const callLogs = await this.getCallLogsByClinic(clinicId);
      const startMs = startDate.getTime();
      const endMs = endDate.getTime();

      const filtered = callLogs.filter((c) => {
        const t =
          c.receivedOn instanceof Date
            ? c.receivedOn.getTime()
            : new Date(c.receivedOn).getTime();

        return t >= startMs && t <= endMs;
      });

      return filtered.sort(
        (a, b) => b.receivedOn.getTime() - a.receivedOn.getTime(),
      );
    } catch (error) {
      console.error("Error fetching call logs by date range:", error);
      throw new Error("Failed to fetch call logs by date range");
    }
  },

  // Get today's call logs
  async getTodaysCallLogs(clinicId: string): Promise<CallLog[]> {
    const today = new Date();
    const startOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );
    const endOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      23,
      59,
      59,
    );

    return this.getCallLogsByDateRange(clinicId, startOfDay, endOfDay);
  },

  // Get call logs by type
  async getCallLogsByType(
    clinicId: string,
    callType: "incoming" | "outgoing",
  ): Promise<CallLog[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),

        where("callType", "==", callType),
      );

      const querySnapshot = await getDocs(q);
      const callLogs: CallLog[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();

        callLogs.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          receivedOn: data.receivedOn?.toDate() || new Date(),
        } as CallLog);
      });

      return callLogs.sort(
        (a, b) => b.receivedOn.getTime() - a.receivedOn.getTime(),
      );
    } catch (error) {
      console.error("Error fetching call logs by type:", error);
      throw new Error("Failed to fetch call logs by type");
    }
  },
};
