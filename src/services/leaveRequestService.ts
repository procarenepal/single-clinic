import {
  collection,
  addDoc,
  updateDoc,
  doc,
  query,
  where,
  getDocs,
  getDoc,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from "firebase/firestore";

import { db } from "@/config/firebase";
import { LeaveRequest, LeaveBalance } from "@/types/models";

const LEAVES_COLLECTION = "leaveRequests";
const BALANCES_COLLECTION = "leaveBalances";

const PAID_LEAVE_TYPES = new Set(["annual", "sick", "casual", "maternity"]);

function toDate(val: any): Date {
  if (!val) return new Date();
  if (val?.toDate) return val.toDate();

  return new Date(val);
}

function mapLeaveRequest(docId: string, data: any): LeaveRequest {
  return {
    ...data,
    id: docId,
    startDate: toDate(data.startDate),
    endDate: toDate(data.endDate),
    reviewedAt: data.reviewedAt ? toDate(data.reviewedAt) : undefined,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  } as LeaveRequest;
}

function mapLeaveBalance(docId: string, data: any): LeaveBalance {
  return {
    ...data,
    id: docId,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  } as LeaveBalance;
}

export const leaveRequestService = {
  // ─── Leave Requests ────────────────────────────────────────────────────────

  async createLeaveRequest(
    req: Omit<LeaveRequest, "id" | "createdAt" | "updatedAt" | "status">,
  ): Promise<string> {
    const docRef = await addDoc(collection(db, LEAVES_COLLECTION), {
      ...req,
      status: "pending",
      startDate: Timestamp.fromDate(new Date(req.startDate)),
      endDate: Timestamp.fromDate(new Date(req.endDate)),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return docRef.id;
  },

  async getLeavesByClinic(
    clinicId: string,
    branchId?: string,
  ): Promise<LeaveRequest[]> {
    let q = query(
      collection(db, LEAVES_COLLECTION),

    );

    if (branchId) {
      q = query(q, where("branchId", "==", branchId));
    }
    const snap = await getDocs(q);
    const leaves = snap.docs.map((d) => mapLeaveRequest(d.id, d.data()));

    return leaves.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  },

  async getLeavesByStaff(
    staffId: string,
    clinicId: string,
  ): Promise<LeaveRequest[]> {
    const q = query(
      collection(db, LEAVES_COLLECTION),
      where("staffId", "==", staffId),

    );
    const snap = await getDocs(q);
    const leaves = snap.docs.map((d) => mapLeaveRequest(d.id, d.data()));

    return leaves.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  },

  async getPendingLeaves(
    clinicId: string,
    branchId?: string,
  ): Promise<LeaveRequest[]> {
    let q = query(
      collection(db, LEAVES_COLLECTION),

      where("status", "==", "pending"),
    );

    if (branchId) {
      q = query(q, where("branchId", "==", branchId));
    }
    const snap = await getDocs(q);
    const leaves = snap.docs.map((d) => mapLeaveRequest(d.id, d.data()));

    return leaves.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  },

  /**
   * Approve a leave request. Also marks attendance records as absent (paid/unpaid)
   * for each day of the leave, and decrements the relevant leave balance.
   */
  async approveLeave(
    leaveId: string,
    reviewerId: string,
    reviewerName: string,
    reviewNotes: string,
  ): Promise<void> {
    const leaveRef = doc(db, LEAVES_COLLECTION, leaveId);
    const leaveSnap = await getDoc(leaveRef);

    if (!leaveSnap.exists()) throw new Error("Leave request not found");

    const leave = mapLeaveRequest(leaveId, leaveSnap.data());
    const batch = writeBatch(db);

    // 1. Update the leave request
    batch.update(leaveRef, {
      status: "approved",
      reviewedBy: reviewerId,
      reviewerName,
      reviewNotes,
      reviewedAt: Timestamp.fromDate(new Date()),
      updatedAt: serverTimestamp(),
    });

    // 2. Decrement leave balance
    const balanceSnap = await getDocs(
      query(
        collection(db, BALANCES_COLLECTION),
        where("staffId", "==", leave.staffId),
        where("clinicId", "==", leave.clinicId),
        where("year", "==", new Date(leave.startDate).getFullYear()),
      ),
    );

    if (!balanceSnap.empty) {
      const balanceRef = doc(db, BALANCES_COLLECTION, balanceSnap.docs[0].id);
      const balanceData = balanceSnap.docs[0].data();
      const assignments = balanceData.assignments || [];
      let unpaidUsed = balanceData.unpaidUsed || 0;

      if (!leave.isPaid) {
        // If it's an explicitly unpaid leave type, it all goes to unpaid
        unpaidUsed += leave.totalDays;
      } else {
        // If it's a paid leave type, find the assignment
        const assignmentIdx = assignments.findIndex(
          (a: any) => a.leaveTypeId === leave.leaveType,
        );

        if (assignmentIdx >= 0) {
          const assignment = assignments[assignmentIdx];
          const newUsedDays = assignment.usedDays + leave.totalDays;

          // Check for overflow
          if (newUsedDays > assignment.assignedDays) {
            const overflow =
              newUsedDays -
              Math.max(assignment.usedDays, assignment.assignedDays);

            if (overflow > 0) unpaidUsed += overflow;
          }

          assignments[assignmentIdx].usedDays = newUsedDays;
        } else {
          // If no assignment exists for this staff member, all days count as unpaid overflow
          unpaidUsed += leave.totalDays;
        }
      }

      batch.update(balanceRef, {
        assignments,
        unpaidUsed,
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
  },

  async rejectLeave(
    leaveId: string,
    reviewerId: string,
    reviewerName: string,
    reviewNotes: string,
  ): Promise<void> {
    const leaveRef = doc(db, LEAVES_COLLECTION, leaveId);

    await updateDoc(leaveRef, {
      status: "rejected",
      reviewedBy: reviewerId,
      reviewerName,
      reviewNotes,
      reviewedAt: Timestamp.fromDate(new Date()),
      updatedAt: serverTimestamp(),
    });
  },

  async cancelLeave(leaveId: string): Promise<void> {
    const leaveRef = doc(db, LEAVES_COLLECTION, leaveId);

    await updateDoc(leaveRef, {
      status: "cancelled",
      updatedAt: serverTimestamp(),
    });
  },

  // ─── Leave Balances ────────────────────────────────────────────────────────

  async getOrCreateBalance(
    staffId: string,
    staffName: string,
    clinicId: string,
    year: number,
  ): Promise<LeaveBalance> {
    const q = query(
      collection(db, BALANCES_COLLECTION),
      where("staffId", "==", staffId),

      where("year", "==", year),
    );
    const snap = await getDocs(q);

    if (!snap.empty) {
      return mapLeaveBalance(snap.docs[0].id, snap.docs[0].data());
    }
    // Create default balance
    const defaultBalance = {
      staffId,
      staffName,
      clinicId,
      year,
      assignments: [],
      unpaidUsed: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    const docRef = await addDoc(
      collection(db, BALANCES_COLLECTION),
      defaultBalance,
    );

    return {
      ...defaultBalance,
      id: docRef.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  },

  async getAllBalancesForClinic(
    clinicId: string,
    year: number,
  ): Promise<LeaveBalance[]> {
    const q = query(
      collection(db, BALANCES_COLLECTION),

      where("year", "==", year),
    );
    const snap = await getDocs(q);

    return snap.docs.map((d) => mapLeaveBalance(d.id, d.data()));
  },

  async updateBalance(
    balanceId: string,
    updates: Partial<Omit<LeaveBalance, "id" | "createdAt" | "updatedAt">>,
  ): Promise<void> {
    const ref = doc(db, BALANCES_COLLECTION, balanceId);

    await updateDoc(ref, { ...updates, updatedAt: serverTimestamp() });
  },
};
