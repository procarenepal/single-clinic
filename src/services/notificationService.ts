import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  updateDoc,
  doc,
  Timestamp,
} from "firebase/firestore";

import { db } from "@/config/firebase";
import { isNotificationForViewer } from "@/services/core/notificationTargetingCore";

export interface ClinicNotification {
  id?: string;
  clinicId: string;
  branchId?: string | null;
  title: string;
  message: string;
  type: string; // "triage" | "doctor_queue" | "expert_queue" | "billing_queue" | "system"
  targetRole?: string | null; // e.g. "doctor" | "expert" | "front-office"
  targetUserId?: string | null; // target specific user/doctor/expert
  read: boolean;
  createdAt: any;
}

export class NotificationService {
  private static COLLECTION_NAME = "notifications";

  static async sendNotification(
    clinicId: string,
    notification: Omit<ClinicNotification, "clinicId" | "read" | "createdAt">,
  ): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, this.COLLECTION_NAME), {
        ...notification,
        clinicId,
        read: false,
        createdAt: Timestamp.now(),
      });

      return docRef.id;
    } catch (error) {
      console.error("Error sending notification:", error);
      throw new Error("Failed to send notification");
    }
  }

  static async markAsRead(notificationId: string): Promise<void> {
    try {
      const docRef = doc(db, this.COLLECTION_NAME, notificationId);

      await updateDoc(docRef, { read: true });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      throw new Error("Failed to update notification");
    }
  }

  static async markAllAsRead(
    clinicId: string,
    userIdOrRole: {
      userId?: string;
      role?: string;
      doctorId?: string;
      expertId?: string;
    },
  ): Promise<void> {
    try {
      // Scoped to this clinic — without it, every clinic's unread
      // notifications were fetched (the bare-collection `list` rule allows
      // that), relying entirely on the client-side filter below to narrow
      // it back down. Harmless today with one clinic's data in the ledger,
      // but a real correctness gap the moment that stops being true.
      const q = query(
        collection(db, this.COLLECTION_NAME),
        where("clinicId", "==", clinicId),
        where("read", "==", false),
      );

      const snapshot = await getDocs(q);
      const batchPromises = snapshot.docs
        .filter((docSnap) =>
          // Same rule the bell dropdown uses to decide what's unread — see
          // notificationTargetingCore for why these must not be two
          // separate reimplementations.
          isNotificationForViewer(docSnap.data(), userIdOrRole),
        )
        .map((docSnap) => {
          return updateDoc(doc(db, this.COLLECTION_NAME, docSnap.id), {
            read: true,
          });
        });

      await Promise.all(batchPromises);
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
    }
  }
}
