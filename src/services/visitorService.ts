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
import { Visitor } from "@/types/models";

const COLLECTION_NAME = "visitors";

export const visitorService = {
  // Create a new visitor entry
  async createVisitor(
    clinicId: string,
    visitorData: Omit<Visitor, "id" | "clinicId" | "createdAt" | "updatedAt">,
  ): Promise<Visitor> {
    try {
      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...visitorData,
        clinicId,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      return {
        id: docRef.id,
        ...visitorData,
        clinicId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } catch (error) {
      console.error("Error creating visitor:", error);
      throw new Error("Failed to create visitor entry");
    }
  },

  // Get all visitors for a clinic
  async getVisitorsByClinic(clinicId: string): Promise<Visitor[]> {
    try {
      const q = query(collection(db, COLLECTION_NAME));

      const querySnapshot = await getDocs(q);
      const visitors: Visitor[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();

        visitors.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          date: data.date?.toDate() || new Date(),
        } as Visitor);
      });

      return visitors.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      );
    } catch (error) {
      console.error("Error fetching visitors:", error);
      throw new Error("Failed to fetch visitors");
    }
  },

  // Get visitor by ID
  async getVisitorById(visitorId: string): Promise<Visitor | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, visitorId);
      const docSnap = await getDocs(
        query(
          collection(db, COLLECTION_NAME),
          where("__name__", "==", visitorId),
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
        date: data.date?.toDate() || new Date(),
      } as Visitor;
    } catch (error) {
      console.error("Error fetching visitor:", error);
      throw new Error("Failed to fetch visitor");
    }
  },

  // Update a visitor entry
  async updateVisitor(
    visitorId: string,
    updates: Partial<
      Omit<Visitor, "id" | "clinicId" | "createdAt" | "updatedAt">
    >,
  ): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, visitorId);

      await updateDoc(docRef, {
        ...updates,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error("Error updating visitor:", error);
      throw new Error("Failed to update visitor");
    }
  },

  // Delete a visitor entry
  async deleteVisitor(visitorId: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, visitorId);

      await deleteDoc(docRef);
    } catch (error) {
      console.error("Error deleting visitor:", error);
      throw new Error("Failed to delete visitor");
    }
  },

  // Get visitors by date range
  async getVisitorsByDateRange(
    clinicId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Visitor[]> {
    try {
      const visitors = await this.getVisitorsByClinic(clinicId);
      const startMs = startDate.getTime();
      const endMs = endDate.getTime();

      const filtered = visitors.filter((v) => {
        const t =
          v.date instanceof Date
            ? v.date.getTime()
            : new Date(v.date).getTime();

        return t >= startMs && t <= endMs;
      });

      return filtered.sort((a, b) => b.date.getTime() - a.date.getTime());
    } catch (error) {
      console.error("Error fetching visitors by date range:", error);
      throw new Error("Failed to fetch visitors by date range");
    }
  },

  // Get today's visitors
  async getTodaysVisitors(clinicId: string): Promise<Visitor[]> {
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

    return this.getVisitorsByDateRange(clinicId, startOfDay, endOfDay);
  },
};
