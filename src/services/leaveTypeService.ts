import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "@/config/firebase";
import { LeaveType } from "@/types/models";

const LEAVE_TYPES_COL = "leaveTypes";

function mapLeaveType(docId: string, data: any): LeaveType {
  return {
    ...data,
    id: docId,
    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
    updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(),
  } as LeaveType;
}

export const leaveTypeService = {
  async getLeaveTypes(clinicId: string): Promise<LeaveType[]> {
    // Bug fix: this previously queried the collection with no clinicId
    // filter at all, so any clinic saw every clinic's leave types (and the
    // "seed defaults if empty" check only ever fired for the very first
    // clinic ever created — after that, the global collection was never
    // empty, so no other clinic got its own defaults).
    const q = query(
      collection(db, LEAVE_TYPES_COL),
      where("clinicId", "==", clinicId),
    );
    const snap = await getDocs(q);

    // Default leaves if none exist for this clinic specifically
    if (snap.empty) {
      return this.seedDefaultLeaveTypes(clinicId);
    }

    return snap.docs.map((d) => mapLeaveType(d.id, d.data()));
  },

  async seedDefaultLeaveTypes(clinicId: string): Promise<LeaveType[]> {
    const defaultTypes = [
      {
        name: "Annual Leave",
        defaultDays: 18,
        color: "bg-blue-500",
        isPaid: true,
      },
      {
        name: "Sick Leave",
        defaultDays: 12,
        color: "bg-rose-500",
        isPaid: true,
      },
      {
        name: "Casual Leave",
        defaultDays: 6,
        color: "bg-violet-500",
        isPaid: true,
      },
      {
        name: "Maternity Leave",
        defaultDays: 90,
        color: "bg-pink-500",
        isPaid: true,
      },
      {
        name: "Paternity Leave",
        defaultDays: 10,
        color: "bg-sky-500",
        isPaid: true,
      },
    ];

    const types: LeaveType[] = [];

    for (const dt of defaultTypes) {
      const typeData = {
        clinicId,
        ...dt,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      const docRef = await addDoc(collection(db, LEAVE_TYPES_COL), typeData);

      types.push(mapLeaveType(docRef.id, typeData));
    }

    return types;
  },

  async addLeaveType(
    data: Omit<LeaveType, "id" | "createdAt" | "updatedAt">,
  ): Promise<string> {
    const docRef = await addDoc(collection(db, LEAVE_TYPES_COL), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return docRef.id;
  },

  async updateLeaveType(
    id: string,
    updates: Partial<Omit<LeaveType, "id" | "createdAt" | "updatedAt">>,
  ): Promise<void> {
    const ref = doc(db, LEAVE_TYPES_COL, id);

    await updateDoc(ref, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  },

  async deleteLeaveType(id: string): Promise<void> {
    const ref = doc(db, LEAVE_TYPES_COL, id);

    await deleteDoc(ref);
  },
};
