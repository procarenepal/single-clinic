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
      const q = query(
        collection(db, this.COLLECTION_NAME),
        where("clinicId", "==", clinicId),
        where("read", "==", false),
      );

      const snapshot = await getDocs(q);
      const batchPromises = snapshot.docs
        .filter((docSnap) => {
          const data = docSnap.data();

          if (userIdOrRole.userId && data.targetUserId === userIdOrRole.userId)
            return true;
          if (
            userIdOrRole.doctorId &&
            data.targetUserId === userIdOrRole.doctorId
          )
            return true;
          if (
            userIdOrRole.expertId &&
            data.targetUserId === userIdOrRole.expertId
          )
            return true;
          if (userIdOrRole.role && data.targetRole === userIdOrRole.role)
            return true;

          return !data.targetUserId && !data.targetRole; // general notification
        })
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
