import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  query,
  where,
  Timestamp,
  increment,
  arrayUnion,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { PatientPackage } from "../types/models";

const PATIENT_PACKAGES_COLLECTION = "patientPackages";

export const patientPackageService = {
  /**
   * Get all active packages for a patient
   */
  async getPatientPackages(patientId: string, clinicId: string): Promise<PatientPackage[]> {
    try {
      const q = query(
        collection(db, PATIENT_PACKAGES_COLLECTION),
        where("patientId", "==", patientId),
        where("clinicId", "==", clinicId)
      );
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => {
        const data = doc.data();
        const expiresAt = data.expiresAt?.toDate();
        let status = data.status;

        // Auto-expire if past validity date
        if (status === "active" && expiresAt && new Date() > expiresAt) {
          status = "expired";
        }

        return {
          id: doc.id,
          ...data,
          status,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          expiresAt,
          sessionHistory: data.sessionHistory?.map((h: any) => ({
            ...h,
            consumedAt: h.consumedAt?.toDate() || new Date(),
          })),
        } as PatientPackage;
      });
    } catch (error) {
      console.error("Error fetching patient packages:", error);
      throw error;
    }
  },

  /**
   * Create a new patient package tracking record
   */
  async createPatientPackage(pkgData: Omit<PatientPackage, "id" | "createdAt" | "updatedAt">): Promise<string> {
    try {
      const now = new Date();
      
      // Generate explicit session tickets if totalSessions is provided
      const sessions = pkgData.sessions || [];
      if (sessions.length === 0 && pkgData.totalSessions > 0) {
        for (let i = 1; i <= pkgData.totalSessions; i++) {
          sessions.push({
            sessionNumber: i,
            status: "pending",
          });
        }
      }

      const data = {
        ...pkgData,
        sessions,
        expiresAt: pkgData.expiresAt ? Timestamp.fromDate(pkgData.expiresAt) : null,
        createdAt: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now),
      };

      const docRef = await addDoc(collection(db, PATIENT_PACKAGES_COLLECTION), data);
      return docRef.id;
    } catch (error) {
      console.error("Error creating patient package:", error);
      throw error;
    }
  },

  /**
   * Start a session (mark as in-progress and link to an appointment)
   */
  async startSession(id: string, appointmentId: string): Promise<void> {
    try {
      const docRef = doc(db, PATIENT_PACKAGES_COLLECTION, id);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) throw new Error("Package not found");

      const data = docSnap.data() as PatientPackage;
      const sessions = data.sessions || [];
      
      // Find the first pending session
      const pendingIndex = sessions.findIndex(s => s.status === "pending");
      if (pendingIndex === -1) {
        // No pending sessions, maybe they are all used or in-progress
        return;
      }

      sessions[pendingIndex] = {
        ...sessions[pendingIndex],
        status: "in-progress",
        appointmentId,
      };

      await updateDoc(docRef, {
        sessions,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error("Error starting session:", error);
      throw error;
    }
  },

  /**
   * Consume a session (increment usedSessions)
   */
  async consumeSession(id: string, auditData?: { appointmentId: string; clinicianId?: string; clinicianName?: string; }): Promise<void> {
    try {
      const docRef = doc(db, PATIENT_PACKAGES_COLLECTION, id);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) throw new Error("Package not found");

      const data = docSnap.data() as PatientPackage;
      const currentUsed = data.usedSessions || 0;
      const totalSessions = data.totalSessions || 0;
      const sessions = data.sessions || [];
      
      const updates: any = {
        usedSessions: increment(1),
        updatedAt: Timestamp.now(),
      };

      if (auditData) {
        updates.sessionHistory = arrayUnion({
          ...auditData,
          consumedAt: Timestamp.now(),
        });
        
        // Find the specific session ticket to mark as completed
        // First try to find one linked to this appointment
        let targetIndex = sessions.findIndex(s => s.appointmentId === auditData.appointmentId && s.status !== "completed");
        
        // If not found, just grab the first pending or in-progress
        if (targetIndex === -1) {
          targetIndex = sessions.findIndex(s => s.status !== "completed");
        }
        
        if (targetIndex !== -1) {
          sessions[targetIndex] = {
            ...sessions[targetIndex],
            status: "completed",
            clinicianId: auditData.clinicianId,
            clinicianName: auditData.clinicianName,
            consumedAt: new Date(),
          };
          updates.sessions = sessions;
        }
      }

      if (currentUsed + 1 >= totalSessions) {
        updates.status = "completed";
      }

      await updateDoc(docRef, updates);
    } catch (error) {
      console.error("Error consuming session:", error);
      throw error;
    }
  }
};
