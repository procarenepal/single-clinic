import {
  collection,
  addDoc,
  updateDoc,
  doc,
  query,
  where,
  getDocs,
  serverTimestamp,
  Timestamp,
  getDoc,
} from "firebase/firestore";

import { db } from "@/config/firebase";
import { StaffMember, StaffAttendance, ClinicHoliday } from "@/types/models";

const STAFF_COLLECTION = "staff";
const ATTENDANCE_COLLECTION = "staff_attendance";
const HOLIDAY_COLLECTION = "clinic_holidays";

export const hrService = {
  // --- Staff Operations ---

  async createStaff(
    staff: Omit<StaffMember, "id" | "createdAt" | "updatedAt">,
  ): Promise<string> {
    const docRef = await addDoc(collection(db, STAFF_COLLECTION), {
      ...staff,
      joiningDate: Timestamp.fromDate(new Date(staff.joiningDate)),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return docRef.id;
  },

  async updateStaff(id: string, staff: Partial<StaffMember>): Promise<void> {
    const docRef = doc(db, STAFF_COLLECTION, id);
    const updateData: any = { ...staff, updatedAt: serverTimestamp() };

    if (staff.joiningDate) {
      updateData.joiningDate = Timestamp.fromDate(new Date(staff.joiningDate));
    }

    await updateDoc(docRef, updateData);
  },

  async getStaffByClinic(
    clinicId: string,
    branchId?: string,
  ): Promise<StaffMember[]> {
    let q = query(collection(db, STAFF_COLLECTION));

    if (branchId) {
      q = query(q, where("branchId", "==", branchId));
    }

    const querySnapshot = await getDocs(q);
    const staff = querySnapshot.docs.map((doc) => {
      const data = doc.data();

      return {
        ...data,
        id: doc.id,
        joiningDate: data.joiningDate?.toDate
          ? data.joiningDate.toDate()
          : new Date(data.joiningDate),
        createdAt: data.createdAt?.toDate
          ? data.createdAt.toDate()
          : new Date(data.createdAt),
        updatedAt: data.updatedAt?.toDate
          ? data.updatedAt.toDate()
          : new Date(data.updatedAt),
      } as StaffMember;
    });

    // Sort in-memory to avoid needing a Firestore composite index
    return staff.sort((a, b) => a.name.localeCompare(b.name));
  },

  // --- Attendance Operations ---

  async markAttendance(
    attendance: Omit<StaffAttendance, "id" | "createdAt" | "updatedAt">,
  ): Promise<string> {
    // Fetch attendance for this staff member to check for duplicates
    const q = query(
      collection(db, ATTENDANCE_COLLECTION),
      where("staffId", "==", attendance.staffId),
    );

    const startOfDay = new Date(attendance.date);

    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(attendance.date);

    endOfDay.setHours(23, 59, 59, 999);

    const querySnapshot = await getDocs(q);
    const existingDoc = querySnapshot.docs.find((doc) => {
      const date = doc.data().date?.toDate
        ? doc.data().date.toDate()
        : new Date(doc.data().date);

      return date >= startOfDay && date <= endOfDay;
    });

    if (existingDoc) {
      const existingId = existingDoc.id;
      const docRef = doc(db, ATTENDANCE_COLLECTION, existingId);

      await updateDoc(docRef, {
        ...attendance,
        date: Timestamp.fromDate(new Date(attendance.date)),
        checkIn: attendance.checkIn
          ? Timestamp.fromDate(new Date(attendance.checkIn))
          : null,
        checkOut: attendance.checkOut
          ? Timestamp.fromDate(new Date(attendance.checkOut))
          : null,
        updatedAt: serverTimestamp(),
      });

      return existingId;
    }

    const docRef = await addDoc(collection(db, ATTENDANCE_COLLECTION), {
      ...attendance,
      date: Timestamp.fromDate(new Date(attendance.date)),
      checkIn: attendance.checkIn
        ? Timestamp.fromDate(new Date(attendance.checkIn))
        : null,
      checkOut: attendance.checkOut
        ? Timestamp.fromDate(new Date(attendance.checkOut))
        : null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return docRef.id;
  },

  async getAttendanceByDate(
    clinicId: string,
    date: Date,
    branchId?: string,
  ): Promise<StaffAttendance[]> {
    const startOfDay = new Date(date);

    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);

    endOfDay.setHours(23, 59, 59, 999);

    return this.getAttendanceByRange(clinicId, startOfDay, endOfDay, branchId);
  },

  async getAttendanceByRange(
    clinicId: string,
    startDate: Date,
    endDate: Date,
    branchId?: string,
  ): Promise<StaffAttendance[]> {
    let q = query(collection(db, ATTENDANCE_COLLECTION));

    if (branchId) {
      q = query(q, where("branchId", "==", branchId));
    }

    const querySnapshot = await getDocs(q);
    const attendance = querySnapshot.docs.map((doc) => {
      const data = doc.data();

      return {
        ...data,
        id: doc.id,
        date: data.date?.toDate ? data.date.toDate() : new Date(data.date),
        checkIn: data.checkIn?.toDate
          ? data.checkIn.toDate()
          : data.checkIn
            ? new Date(data.checkIn)
            : null,
        checkOut: data.checkOut?.toDate
          ? data.checkOut.toDate()
          : data.checkOut
            ? new Date(data.checkOut)
            : null,
        createdAt: data.createdAt?.toDate
          ? data.createdAt.toDate()
          : new Date(data.createdAt),
        updatedAt: data.updatedAt?.toDate
          ? data.updatedAt.toDate()
          : new Date(data.updatedAt),
      } as StaffAttendance;
    });

    // Filter by date range in-memory
    return attendance.filter((a) => a.date >= startDate && a.date <= endDate);
  },

  async updateAttendance(
    id: string,
    attendance: Partial<StaffAttendance>,
  ): Promise<void> {
    const docRef = doc(db, ATTENDANCE_COLLECTION, id);
    const updateData: any = { ...attendance, updatedAt: serverTimestamp() };

    if (attendance.date) {
      updateData.date = Timestamp.fromDate(new Date(attendance.date));
    }
    if (attendance.checkIn) {
      updateData.checkIn = Timestamp.fromDate(new Date(attendance.checkIn));
    }
    if (attendance.checkOut) {
      const checkOutDate = new Date(attendance.checkOut);

      updateData.checkOut = Timestamp.fromDate(checkOutDate);

      // Calculate totalHours if checkIn is available
      if (attendance.checkIn) {
        const checkInDate = new Date(attendance.checkIn);
        const diffMs = checkOutDate.getTime() - checkInDate.getTime();

        updateData.totalHours = parseFloat(
          (diffMs / (1000 * 60 * 60)).toFixed(2),
        );
      } else {
        // Try to fetch current doc to get existing checkIn
        try {
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const existingData = docSnap.data();
            const existingCheckIn = existingData.checkIn?.toDate
              ? existingData.checkIn.toDate()
              : existingData.checkIn
                ? new Date(existingData.checkIn)
                : null;

            if (existingCheckIn) {
              const diffMs = checkOutDate.getTime() - existingCheckIn.getTime();

              updateData.totalHours = parseFloat(
                (diffMs / (1000 * 60 * 60)).toFixed(2),
              );
            }
          }
        } catch (e) {
          console.error("Error fetching attendance for hour calculation:", e);
        }
      }
    }

    await updateDoc(docRef, updateData);
  },

  // --- Holiday Operations ---

  async getHolidays(clinicId: string): Promise<ClinicHoliday[]> {
    const q = query(collection(db, HOLIDAY_COLLECTION));
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => {
      const data = doc.data();

      return {
        id: doc.id,
        clinicId: data.clinicId || clinicId,
        name: data.name,
        date: data.date?.toDate ? data.date.toDate() : new Date(data.date),
        type: data.type || "paid",
      };
    });
  },

  async addHoliday(
    clinicId: string,
    name: string,
    date: Date,
    type: "paid" | "unpaid" = "paid",
  ): Promise<string> {
    const docRef = await addDoc(collection(db, HOLIDAY_COLLECTION), {
      clinicId,
      name,
      type,
      date: Timestamp.fromDate(new Date(date)),
      createdAt: serverTimestamp(),
    });

    return docRef.id;
  },

  async deleteHoliday(id: string): Promise<void> {
    const { deleteDoc } = await import("firebase/firestore");
    const docRef = doc(db, HOLIDAY_COLLECTION, id);

    await deleteDoc(docRef);
  },
};
