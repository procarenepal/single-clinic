import type {
  PatientFollowup,
  FollowupStatus,
  FollowupInitStatus,
  FollowupUpdatedStatus,
} from "@/types/models";

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  Timestamp,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "@/config/firebase";

const COLLECTION = "patientFollowups";

// ─── Helpers ────────────────────────────────────────────────────────────────

function toDate(val: any): Date | undefined {
  if (!val) return undefined;
  if (val instanceof Date) return val;
  if (val?.seconds) return new Date(val.seconds * 1000);

  return new Date(val);
}

function mapDoc(id: string, data: any): PatientFollowup {
  return {
    id,
    clinicId: data.clinicId || "",
    branchId: data.branchId || "",
    patientId: data.patientId || "",
    patientName: data.patientName || "",
    patientMobile: data.patientMobile || "",
    appointmentId: data.appointmentId,
    visitDate: toDate(data.visitDate),
    session: data.session,
    initStatus: (data.initStatus as FollowupInitStatus) || "neutral",
    updatedStatus: data.updatedStatus as FollowupUpdatedStatus | undefined,
    followupDates: {
      first: toDate(data.followupDates?.first),
      second: toDate(data.followupDates?.second),
      third: toDate(data.followupDates?.third),
      fourth: toDate(data.followupDates?.fourth),
      fifth: toDate(data.followupDates?.fifth),
    },
    nextFollowupDate: toDate(data.nextFollowupDate),
    followedBy: data.followedBy,
    sessionStatuses: data.sessionStatuses || {},
    service: data.service,
    product: data.product,
    notes: data.notes,
    noteHistory:
      data.noteHistory?.map((n: any) => ({
        date: toDate(n.date) || new Date(),
        note: n.note,
        user: n.user,
      })) || [],
    overallStatus: (data.overallStatus as FollowupStatus) || "pending",
    logs:
      data.logs?.map((l: any) => ({
        date: toDate(l.date) || new Date(),
        note: l.note,
        user: l.user,
      })) || [],
    createdAt: toDate(data.createdAt) || new Date(),
    updatedAt: toDate(data.updatedAt) || new Date(),
    createdBy: data.createdBy || "",
  };
}

function toTimestamp(date?: Date): Timestamp | null {
  if (!date) return null;

  return Timestamp.fromDate(date);
}

function serializeDates(followup: Partial<PatientFollowup>): any {
  const result: any = { ...followup };

  if ("visitDate" in followup) {
    result.visitDate = followup.visitDate
      ? toTimestamp(followup.visitDate)
      : null;
  }

  if ("followupDates" in followup) {
    result.followupDates = followup.followupDates
      ? {
          first: toTimestamp(followup.followupDates.first),
          second: toTimestamp(followup.followupDates.second),
          third: toTimestamp(followup.followupDates.third),
          fourth: toTimestamp(followup.followupDates.fourth),
          fifth: toTimestamp(followup.followupDates.fifth),
        }
      : {};
  }

  if ("nextFollowupDate" in followup) {
    result.nextFollowupDate = followup.nextFollowupDate
      ? toTimestamp(followup.nextFollowupDate)
      : null;
  }

  if ("noteHistory" in followup) {
    result.noteHistory =
      followup.noteHistory?.map((n) => ({
        ...n,
        date: toTimestamp(n.date) || null,
      })) || [];
  }

  if ("logs" in followup) {
    result.logs =
      followup.logs?.map((l) => ({
        ...l,
        date: toTimestamp(l.date) || null,
      })) || [];
  }

  return result;
}

// ─── Service ────────────────────────────────────────────────────────────────

export const followupService = {
  /**
   * Fetch all follow-ups for a clinic/branch.
   */
  async getFollowups(
    clinicId: string,
    branchId?: string,
  ): Promise<PatientFollowup[]> {
    let q = query(collection(db, COLLECTION));

    if (branchId) {
      q = query(
        collection(db, COLLECTION),

        where("branchId", "==", branchId),
      );
    }

    const snap = await getDocs(q);
    const results = snap.docs.map((d) => mapDoc(d.id, d.data()));

    // Sort in-memory by createdAt desc to avoid composite index
    results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return results;
  },

  /**
   * Get a single follow-up record by ID.
   */
  async getFollowupById(id: string): Promise<PatientFollowup | null> {
    const snap = await getDoc(doc(db, COLLECTION, id));

    if (!snap.exists()) return null;

    return mapDoc(snap.id, snap.data());
  },

  /**
   * Get all follow-ups for a specific patient.
   */
  async getPatientFollowups(patientId: string): Promise<PatientFollowup[]> {
    const q = query(
      collection(db, COLLECTION),
      where("patientId", "==", patientId),
    );
    const snap = await getDocs(q);
    const results = snap.docs.map((d) => mapDoc(d.id, d.data()));

    results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return results;
  },

  /**
   * Get follow-ups that are due today or in the next N days.
   */
  async getDueFollowups(
    clinicId: string,
    days: number = 7,
  ): Promise<PatientFollowup[]> {
    const all = await this.getFollowups(clinicId);
    const now = new Date();
    const cutoff = new Date();

    cutoff.setDate(cutoff.getDate() + days);

    return all.filter((f) => {
      if (f.overallStatus === "completed" || f.overallStatus === "cancelled")
        return false;
      const dates = Object.values(f.followupDates).filter(Boolean) as Date[];

      return dates.some((d) => d >= now && d <= cutoff);
    });
  },

  /**
   * Create a new follow-up record.
   */
  async createFollowup(
    data: Omit<PatientFollowup, "id" | "createdAt" | "updatedAt">,
  ): Promise<string> {
    const payload = {
      ...serializeDates(data),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    const ref = await addDoc(collection(db, COLLECTION), payload);

    return ref.id;
  },

  /**
   * Update an existing follow-up record.
   */
  async updateFollowup(
    id: string,
    data: Partial<PatientFollowup>,
  ): Promise<void> {
    const { id: _id, createdAt: _ca, ...rest } = data as any;
    const payload = {
      ...serializeDates(rest),
      updatedAt: serverTimestamp(),
    };

    await updateDoc(doc(db, COLLECTION, id), payload);
  },

  /**
   * Delete a follow-up record.
   */
  async deleteFollowup(id: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTION, id));
  },
};
