import type {
  PatientFollowup,
  FollowupStatus,
  FollowupInitStatus,
  FollowupUpdatedStatus,
  FollowupCategory,
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

// ─── Status helpers ─────────────────────────────────────────────────────────
// overallStatus conflates two concerns: true LIFECYCLE state (is this
// follow-up still open) and OUTCOME/sentiment (how did the call go). The
// lifecycle-closing values are exactly these two — everything else
// (satisfy/not-satisfy/will-come/complain/angry/no-answer/wrong-no) is an
// outcome value that leaves the follow-up open unless overallStatus is also
// separately set to "completed"/"cancelled". Use this helper everywhere
// instead of ad-hoc `!== "completed" && !== "cancelled"` checks, so the
// definition of "still open" lives in exactly one place.
const CLOSED_STATUSES: FollowupStatus[] = ["completed", "cancelled"];

export function isFollowupOpen(status: FollowupStatus): boolean {
  return !CLOSED_STATUSES.includes(status);
}

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
    category: data.category || "general",
    patientId: data.patientId || "",
    patientName: data.patientName || "",
    patientMobile: data.patientMobile || "",
    appointmentId: data.appointmentId,
    billingId: data.billingId,
    purchaseId: data.purchaseId,
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
    followedByUserId: data.followedByUserId,
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
  ): Promise<PatientFollowup[]> {
    // Previously ignored clinicId entirely and queried the whole collection
    // unscoped — harmless today only because this deployment is
    // permanently single-clinic (see single-clinic-deployment convention
    // elsewhere in the app), but the parameter existing and being silently
    // discarded was actively misleading.
    const q = query(collection(db, COLLECTION), where("clinicId", "==", clinicId));

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
   * Get follow-ups that are due today or in the next N days (upcoming only
   * — excludes anything already overdue; see getOverdueFollowups for that).
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
      if (!isFollowupOpen(f.overallStatus)) return false;
      const dates = [
        ...Object.values(f.followupDates),
        f.nextFollowupDate,
      ].filter(Boolean) as Date[];

      return dates.some((d) => d >= now && d <= cutoff);
    });
  },

  /**
   * Get follow-ups that are OVERDUE — still open (not completed/cancelled)
   * with every one of their set dates already in the past, OR with no date
   * set at all. Previously there was no overdue concept anywhere: a
   * follow-up due days ago just silently dropped out of the Today/Tomorrow
   * filters with nothing surfacing it again. A follow-up with no date set
   * at all (every auto-created one, before this fix) is treated as overdue
   * too — it's been sitting unactioned since creation with no way to ever
   * become "due" on its own.
   */
  async getOverdueFollowups(clinicId: string): Promise<PatientFollowup[]> {
    const all = await this.getFollowups(clinicId);
    const now = new Date();

    return all.filter((f) => {
      if (!isFollowupOpen(f.overallStatus)) return false;

      const dates = [
        ...Object.values(f.followupDates),
        f.nextFollowupDate,
      ].filter(Boolean) as Date[];

      if (dates.length === 0) return true; // never scheduled — needs attention
      return dates.every((d) => d < now);
    });
  },

  /**
   * Find an existing PENDING follow-up for a patient (optionally scoped to
   * one category), so auto-creation call sites can update/reuse it instead
   * of always inserting a new document — mirrors the dedup check
   * FollowupModal.tsx already does for manual creation, which none of the
   * 4 auto-creation sites (appointment/pathology/pharmacy billing) had.
   */
  async findPendingFollowup(
    patientId: string,
    category?: FollowupCategory,
  ): Promise<PatientFollowup | null> {
    if (!patientId) return null;

    const existing = await this.getPatientFollowups(patientId);
    const match = existing.find(
      (f) =>
        f.overallStatus === "pending" &&
        (!category || f.category === category),
    );

    return match || null;
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
