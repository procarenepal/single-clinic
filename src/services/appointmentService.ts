import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  getDoc,
  Timestamp,
  onSnapshot,
  QuerySnapshot,
  DocumentData,
  QueryDocumentSnapshot,
  DocumentSnapshot,
  runTransaction,
  increment,
} from "firebase/firestore";

import { db } from "@/config/firebase";
import { cacheService } from "@/services/cacheService";
import { Appointment, AppointmentBillingItem } from "@/types/models";
import { mergeVisitLines } from "@/services/core/legacyVisitAdapters";
import { parseLocalDate } from "@/utils/localDate";
import { resolveClinicId } from "./currentClinic";

type AppointmentSnapshotHandler = (appointments: Appointment[]) => void;
type AppointmentErrorHandler = (error: Error) => void;

// Firestore rejects `undefined` anywhere in a write, including nested
// inside array elements (e.g. an AppointmentBillingItem whose optional
// isTaxable/taxRate/calculateCommission were left unset) — a top-level-only
// strip of undefined keys misses those. Mirrors
// appointmentBillingService.deepClean, which exists for the same reason.
const deepCleanUndefined = <T,>(value: T): T => {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => deepCleanUndefined(item)) as unknown as T;
  }

  if (value instanceof Date || value instanceof Timestamp) {
    return value;
  }

  const cleaned: any = {};

  Object.keys(value as object).forEach((key) => {
    const v = (value as any)[key];

    if (v !== undefined) {
      cleaned[key] = deepCleanUndefined(v);
    }
  });

  return cleaned;
};

const mapAppointmentDoc = (
  docSnap: QueryDocumentSnapshot<DocumentData> | DocumentSnapshot<DocumentData>,
): Appointment => {
  const data = docSnap.data();

  if (!data) {
    throw new Error("Appointment data is undefined");
  }

  const parseDate = (val: any) => {
    if (!val) return undefined;
    if (typeof val.toDate === "function") return val.toDate();
    if (typeof val === "string" || typeof val === "number")
      return parseLocalDate(val);

    return undefined;
  };

  return {
    id: docSnap.id,
    ...data,
    appointmentDate: parseDate(data.appointmentDate) || new Date(),
    appointmentBS: parseDate(data.appointmentBS),
    registrationDate: parseDate(data.registrationDate) || new Date(),
    createdAt: parseDate(data.createdAt) || new Date(),
    updatedAt: parseDate(data.updatedAt) || new Date(),
  } as Appointment;
};

const handleAppointmentSnapshot = (
  snapshot: QuerySnapshot<DocumentData>,
  onData: AppointmentSnapshotHandler,
) => {
  const nextAppointments: Appointment[] = [];

  snapshot.forEach((docSnap) => {
    nextAppointments.push(mapAppointmentDoc(docSnap));
  });
  onData(nextAppointments);
};

export const appointmentService = {
  /**
   * Create a new appointment
   * @param {Partial<Appointment>} appointmentData - Appointment data
   * @returns {Promise<string>} - ID of the created appointment
   */
  async createAppointment(
    appointmentData: Partial<Appointment>,
  ): Promise<string> {
    try {
      const appointmentsCollection = collection(db, "appointments");

      // Conflict check: block booking the same clinician into the exact
      // same date+time slot twice. Previously createAppointment was a pure
      // additive write with no check at all — this is a conservative,
      // exact-slot-collision guard (not full time-range overlap math), but
      // closes the most obvious double-booking case with low risk of
      // false positives on legitimate flows.
      const clinicianId =
        appointmentData.doctorId && appointmentData.doctorId !== "unassigned"
          ? appointmentData.doctorId
          : appointmentData.assignedExpertId;

      if (clinicianId && appointmentData.appointmentDate && appointmentData.startTime) {
        const dayStart = new Date(appointmentData.appointmentDate);

        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart);

        dayEnd.setDate(dayEnd.getDate() + 1);

        const conflictQuery = query(
          appointmentsCollection,
          // Without the clinicId predicate this list is unauthorised for every
          // non-admin, so the double-booking guard threw and took appointment
          // creation down with it — and receptionists are precisely the role
          // that books appointments. clinic-admin was unaffected because the
          // rule short-circuits it as a super admin.
          where("clinicId", "==", resolveClinicId(appointmentData.clinicId)),
          where(
            appointmentData.doctorId && appointmentData.doctorId !== "unassigned"
              ? "doctorId"
              : "assignedExpertId",
            "==",
            clinicianId,
          ),
          where("startTime", "==", appointmentData.startTime),
          where("appointmentDate", ">=", Timestamp.fromDate(dayStart)),
          where("appointmentDate", "<", Timestamp.fromDate(dayEnd)),
        );
        const conflictSnap = await getDocs(conflictQuery);
        const activeConflict = conflictSnap.docs.find((d) => {
          const status = d.data().status;

          return status !== "cancelled" && status !== "no-show";
        });

        if (activeConflict) {
          throw new Error(
            "This clinician already has an appointment booked at this exact date and time. Please choose a different slot.",
          );
        }
      }

      // Prepare data for Firestore and filter out undefined values
      const firestoreData: any = {
        patientId: appointmentData.patientId,
        clinicId: appointmentData.clinicId,
        doctorId: appointmentData.doctorId,
        appointmentTypeId: appointmentData.appointmentTypeId,
        status: appointmentData.status || "scheduled",
        appointmentDate: appointmentData.appointmentDate
          ? Timestamp.fromDate(appointmentData.appointmentDate)
          : null,
        registrationDate: appointmentData.registrationDate
          ? Timestamp.fromDate(appointmentData.registrationDate)
          : Timestamp.now(),
        createdBy: appointmentData.createdBy,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      // Only add optional fields if they have values
      if (appointmentData.appointmentBS) {
        firestoreData.appointmentBS = Timestamp.fromDate(
          appointmentData.appointmentBS,
        );
      }
      if (appointmentData.startTime) {
        firestoreData.startTime = appointmentData.startTime;
      }
      if (appointmentData.endTime) {
        firestoreData.endTime = appointmentData.endTime;
      }
      if (appointmentData.reason && appointmentData.reason.trim()) {
        firestoreData.reason = appointmentData.reason.trim();
      }
      if (appointmentData.notes && appointmentData.notes.trim()) {
        firestoreData.notes = appointmentData.notes.trim();
      }
      if (appointmentData.branchId) {
        firestoreData.branchId = appointmentData.branchId;
      }
      if (appointmentData.assignedExpertId) {
        firestoreData.assignedExpertId = appointmentData.assignedExpertId;
      }
      if (appointmentData.billingId) {
        firestoreData.billingId = appointmentData.billingId;
      }
      // Tested against undefined rather than truthiness: these fields carry
      // meaningful "empty" values (null to clear a stale invoice pointer),
      // and a truthiness check silently dropped those writes — so a legacy
      // consultationBillingId could never be cleared through this method.
      if (appointmentData.billingStatus !== undefined) {
        firestoreData.billingStatus = appointmentData.billingStatus;
      }
      if (appointmentData.paymentStatus !== undefined) {
        firestoreData.paymentStatus = appointmentData.paymentStatus;
      }
      if (appointmentData.consultationBillingId !== undefined) {
        firestoreData.consultationBillingId =
          appointmentData.consultationBillingId;
      }
      if (appointmentData.consultationBillingStatus !== undefined) {
        firestoreData.consultationBillingStatus =
          appointmentData.consultationBillingStatus;
      }
      if (appointmentData.checkoutCompleted !== undefined) {
        firestoreData.checkoutCompleted = appointmentData.checkoutCompleted;
      }
      if (appointmentData.doctorConsultationCompleted !== undefined) {
        firestoreData.doctorConsultationCompleted =
          appointmentData.doctorConsultationCompleted;
      }
      if (appointmentData.cabinName) {
        firestoreData.cabinName = appointmentData.cabinName;
      }
      if (appointmentData.patientPackageId) {
        firestoreData.patientPackageId = appointmentData.patientPackageId;
      }

      const docRef = await addDoc(appointmentsCollection, firestoreData);

      if (appointmentData.clinicId) {
        cacheService.invalidateClinicAppointments(appointmentData.clinicId);
        if (appointmentData.doctorId) {
          cacheService.invalidateClinicDoctorAppointments(
            appointmentData.clinicId,
            appointmentData.doctorId,
          );
        }
      }

      return docRef.id;
    } catch (error) {
      console.error("Error creating appointment:", error);
      // Preserve the specific conflict message (thrown above) instead of
      // masking it with a generic one — callers/UI need to know why.
      if (error instanceof Error && error.message.includes("already has an appointment")) {
        throw error;
      }
      throw new Error("Failed to create appointment");
    }
  },

  /**
   * Get all appointments (excluding deleted/cancelled)
   */
  async getAppointments(): Promise<Appointment[]> {
    try {
      const appointmentsCollection = collection(db, "appointments");
      const q = query(
        appointmentsCollection,
        where("clinicId", "==", resolveClinicId()),
        orderBy("appointmentDate", "desc"),
      );
      const querySnapshot = await getDocs(q);
      const appointments: Appointment[] = [];

      querySnapshot.forEach((docSnap) => {
        appointments.push(mapAppointmentDoc(docSnap));
      });

      return appointments;
    } catch (error) {
      console.error("Error fetching all appointments:", error);
      throw new Error("Failed to fetch all appointments");
    }
  },

  /**
   * Alias for backward compatibility.
   *
   * Bug fix: this used to call getAppointments() (no clinicId filter at
   * all) and just used clinicId as a cache key — every clinic's
   * appointments were returned to every caller. Now genuinely scoped.
   */
  async getAppointmentsByClinic(
    clinicId?: string,
  ): Promise<Appointment[]> {
    try {
      const appointmentsCollection = collection(db, "appointments");
      const constraints = clinicId ? [where("clinicId", "==", clinicId)] : [];

      const q = query(appointmentsCollection, ...constraints);
      const querySnapshot = await getDocs(q);
      const appointments: Appointment[] = [];

      querySnapshot.forEach((docSnap) => {
        appointments.push(mapAppointmentDoc(docSnap));
      });

      appointments.sort(
        (a, b) => b.appointmentDate.getTime() - a.appointmentDate.getTime(),
      );

      if (clinicId) {
        cacheService.setClinicAppointments(clinicId, appointments);
      } else {
        cacheService.setClinicAppointments("standalone", appointments);
      }

      return appointments;
    } catch (error) {
      console.error("Error fetching appointments by clinic:", error);
      throw new Error("Failed to fetch appointments by clinic");
    }
  },

  /**
   * Get all appointments for a specific patient
   * @param {string} patientId - ID of the patient
   * @returns {Promise<Appointment[]>} - Array of appointments for the patient
   */
  async getAppointmentsByPatient(patientId: string): Promise<Appointment[]> {
    try {
      const appointmentsCollection = collection(db, "appointments");
      // Scoped to the clinic so Firestore can authorise the read — the
      // rule requires resource.data.clinicId to match the caller's clinic.
      const q = query(
        appointmentsCollection,
        where("patientId", "==", patientId),
        where("clinicId", "==", resolveClinicId()),
      );

      const querySnapshot = await getDocs(q);
      const appointments: Appointment[] = [];

      querySnapshot.forEach((doc) => {
        appointments.push(mapAppointmentDoc(doc));
      });

      // Sort by date descending in memory to avoid index error
      return appointments.sort(
        (a, b) => b.appointmentDate.getTime() - a.appointmentDate.getTime(),
      );
    } catch (error) {
      console.error("Error fetching patient appointments:", error);
      throw new Error("Failed to fetch patient appointments");
    }
  },

  /**
   * Get all appointments for a specific doctor
   * @param {string} doctorId - ID of the doctor
   * @returns {Promise<Appointment[]>} - Array of appointments for the doctor
   */
  async getAppointmentsByDoctor(doctorId: string): Promise<Appointment[]> {
    try {
      // No clinicId in signature; leave cache out for now or extend API
      const appointmentsCollection = collection(db, "appointments");
      // Scoped to the clinic so Firestore can authorise the read — the
      // rule requires resource.data.clinicId to match the caller's clinic.
      const q = query(
        appointmentsCollection,
        where("doctorId", "==", doctorId),
        where("clinicId", "==", resolveClinicId()),
      );

      const querySnapshot = await getDocs(q);
      const appointments: Appointment[] = [];

      querySnapshot.forEach((doc) => {
        appointments.push(mapAppointmentDoc(doc));
      });

      // Sort by date descending in memory to avoid index error
      return appointments.sort(
        (a, b) => b.appointmentDate.getTime() - a.appointmentDate.getTime(),
      );
    } catch (error) {
      console.error("Error fetching doctor appointments:", error);
      throw new Error("Failed to fetch doctor appointments");
    }
  },

  /**
   * Get all appointments for a specific expert
   * @param {string} expertId - ID of the expert
   * @returns {Promise<Appointment[]>} - Array of appointments for the expert
   */
  async getAppointmentsByExpert(expertId: string): Promise<Appointment[]> {
    try {
      const appointmentsCollection = collection(db, "appointments");
      const scopedClinicId = resolveClinicId();
      const q1 = query(
        appointmentsCollection,
        where("assignedExpertId", "==", expertId),
        where("clinicId", "==", scopedClinicId),
      );
      const q2 = query(
        appointmentsCollection,
        where("doctorId", "==", expertId),
        where("clinicId", "==", scopedClinicId),
      );

      const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
      const map = new Map<string, Appointment>();

      snap1.forEach((doc) => map.set(doc.id, mapAppointmentDoc(doc)));
      snap2.forEach((doc) => map.set(doc.id, mapAppointmentDoc(doc)));

      return Array.from(map.values()).sort(
        (a, b) => b.appointmentDate.getTime() - a.appointmentDate.getTime(),
      );
    } catch (error) {
      console.error("Error fetching expert appointments:", error);
      throw new Error("Failed to fetch expert appointments");
    }
  },

  /**
   * Get a single appointment by ID
   * @param {string} appointmentId - ID of the appointment
   * @returns {Promise<Appointment | null>} - Appointment or null if not found
   */
  async getAppointmentById(appointmentId: string): Promise<Appointment | null> {
    try {
      const appointmentDoc = doc(db, "appointments", appointmentId);
      const appointmentSnap = await getDoc(appointmentDoc);

      if (appointmentSnap.exists()) {
        return mapAppointmentDoc(appointmentSnap);
      }

      return null;
    } catch (error) {
      console.error("Error fetching appointment:", error);
      throw new Error("Failed to fetch appointment");
    }
  },

  /**
   * Update an appointment's information
   * @param {string} appointmentId - Appointment ID
   * @param {Partial<Appointment>} updateData - Updated appointment data
   * @returns {Promise<void>}
   */
  async updateAppointment(
    appointmentId: string,
    updateData: Partial<Appointment>,
  ): Promise<void> {
    try {
      const appointmentDoc = doc(db, "appointments", appointmentId);

      // Prepare data for Firestore
      const firestoreData = {
        ...updateData,
        appointmentDate: updateData.appointmentDate
          ? Timestamp.fromDate(updateData.appointmentDate)
          : undefined,
        appointmentBS: updateData.appointmentBS
          ? Timestamp.fromDate(updateData.appointmentBS)
          : undefined,
        registrationDate: updateData.registrationDate
          ? Timestamp.fromDate(updateData.registrationDate)
          : undefined,
        updatedAt: Timestamp.now(),
      };

      // Remove undefined values, including inside nested arrays/objects
      // (e.g. pendingVisitItems entries with optional fields left unset) —
      // Firestore rejects undefined anywhere in the write, not just at the
      // top level.
      const cleanedFirestoreData = deepCleanUndefined(firestoreData);

      await updateDoc(appointmentDoc, cleanedFirestoreData);

      const updatedSnap = await getDoc(appointmentDoc);

      if (updatedSnap.exists()) {
        const updatedData = updatedSnap.data();

        if (updatedData.clinicId) {
          cacheService.invalidateClinicAppointments(updatedData.clinicId);
          if (updatedData.doctorId) {
            cacheService.invalidateClinicDoctorAppointments(
              updatedData.clinicId,
              updatedData.doctorId,
            );
          }
        }
      }
    } catch (error) {
      console.error("Error updating appointment:", error);
      throw new Error("Failed to update appointment");
    }
  },

  /**
   * Move a scheduled visit to the lobby, once. Two desks clicking Check In
   * both land here; only the first transitions. The deposit is taken in
   * its own transaction (visitLineService.collectCheckInDue, which re-reads
   * what is still due), so the second desk takes no money of its own.
   */
  async checkInAppointment(
    appointmentId: string,
    now: Date,
  ): Promise<{ transitioned: boolean; status: string; clinicId?: string }> {
    const appointmentRef = doc(db, "appointments", appointmentId);
    const result = await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(appointmentRef);

      if (!snap.exists()) {
        throw new Error("Appointment not found");
      }
      const data = snap.data();
      const status = String(data.status || "");

      if (status !== "scheduled") {
        return { transitioned: false, status, clinicId: data.clinicId };
      }
      transaction.update(appointmentRef, {
        status: "confirmed",
        checkedInAt: Timestamp.fromDate(now),
        updatedAt: Timestamp.now(),
      });

      return { transitioned: true, status: "confirmed", clinicId: data.clinicId };
    });

    if (result.clinicId) {
      cacheService.invalidateClinicAppointments(result.clinicId);
    }

    return result;
  },

  async markCheckInDepositFailed(
    appointmentId: string,
    failed: boolean,
  ): Promise<void> {
    await updateDoc(doc(db, "appointments", appointmentId), {
      checkInDepositFailedAt: failed ? Timestamp.now() : null,
      updatedAt: Timestamp.now(),
    });
  },

  /**
   * Append lines to this visit atomically, skipping any already on it (see
   * mergeVisitLines for the one identity rule). A plain read-modify-write
   * from two desks at once lost one desk's lines. Returns what was actually
   * added and what was already there.
   */
  async appendPendingVisitLines(
    appointmentId: string,
    lines: AppointmentBillingItem[],
  ): Promise<{
    added: AppointmentBillingItem[];
    skipped: AppointmentBillingItem[];
  }> {
    if (lines.length === 0) return { added: [], skipped: [] };

    const appointmentRef = doc(db, "appointments", appointmentId);

    return runTransaction(db, async (transaction) => {
      const snap = await transaction.get(appointmentRef);

      if (!snap.exists()) {
        throw new Error("Appointment not found");
      }

      const data = snap.data();
      const merged = mergeVisitLines(
        (data.pendingVisitItems || []) as AppointmentBillingItem[],
        lines,
        data.appointmentTypeId,
      );

      if (merged.added.length > 0) {
        transaction.update(appointmentRef, {
          pendingVisitItems: merged.next,
          updatedAt: Timestamp.now(),
        });
      }

      return { added: merged.added, skipped: merged.skipped };
    });
  },

  /**
   * Re-point an already-on-the-visit booked line at a DIFFERENT clinician —
   * for when the visit's doctor/expert was cleared and reassigned (Undo
   * Check-In, Send Back to Lobby) after the fee was already collected.
   *
   * findBookedLine deliberately matches a booked line by service type
   * alone, "whoever performs it" — so once a visit's consultation fee is
   * collected, routing it to a second clinician correctly does not charge
   * it again. But nothing re-aims the EXISTING line at the new clinician
   * either, so the original clinician who never saw the patient stayed the
   * one invoiced and commissioned. This patches doctorId/doctorName/
   * performerKind on that one line in place — never appends or removes a
   * line, so it can't create or lose a charge, only correct who it is
   * attributed to.
   */
  async reattributeVisitLine(
    appointmentId: string,
    lineId: string,
    clinician: { id: string; name: string; kind: "doctor" | "expert" },
  ): Promise<void> {
    const appointmentRef = doc(db, "appointments", appointmentId);

    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(appointmentRef);

      if (!snap.exists()) return;

      const data = snap.data();
      const lines = (data.pendingVisitItems || []) as AppointmentBillingItem[];
      const idx = lines.findIndex((l) => l.id === lineId);

      if (idx === -1) return;
      if (
        lines[idx].doctorId === clinician.id &&
        lines[idx].performerKind === clinician.kind
      ) {
        return;
      }

      const next = lines.slice();

      next[idx] = {
        ...next[idx],
        doctorId: clinician.id,
        doctorName: clinician.name,
        performerKind: clinician.kind,
      };

      transaction.update(appointmentRef, {
        pendingVisitItems: next,
        updatedAt: Timestamp.now(),
      });
    });
  },

  /**
   * Release part of the visit's recorded deposit once checkout has applied
   * it to the invoice (or returned unused credit to the wallet), together
   * with whatever share of it was wallet credit. One write for both: as two
   * writes, depositFromCredit briefly exceeded depositedAmount — a state
   * the appointments rule refuses. Atomic decrements rather than recomputed
   * values, so a concurrent write isn't clobbered. The positive direction
   * is written only by visitLineService.collectCheckInDue, in the same
   * transaction as the wallet ledger row that vouches for it.
   */
  async releaseVisitDeposit(
    appointmentId: string,
    amount: number,
    fromCredit: number = 0,
  ): Promise<void> {
    if (!(amount > 0)) return;

    const data: Record<string, unknown> = {
      depositedAmount: increment(-amount),
      updatedAt: Timestamp.now(),
    };

    if (fromCredit > 0) data.depositFromCredit = increment(-fromCredit);

    await updateDoc(doc(db, "appointments", appointmentId), data);
  },

  /**
   * Update appointment status
   * @param {string} appointmentId - Appointment ID
   * @param {string} status - New status
   * @returns {Promise<void>}
   */
  async updateAppointmentStatus(
    appointmentId: string,
    status:
      | "scheduled"
      | "confirmed"
      | "in-progress"
      | "completed"
      | "cancelled"
      | "no-show",
  ): Promise<void> {
    try {
      const appointmentDoc = doc(db, "appointments", appointmentId);

      await updateDoc(appointmentDoc, {
        status,
        updatedAt: Timestamp.now(),
      });

      const appointment = await getDoc(appointmentDoc);

      if (appointment.exists()) {
        const data = appointment.data();

        if (data.clinicId) {
          cacheService.invalidateClinicAppointments(data.clinicId);
          if (data.doctorId) {
            cacheService.invalidateClinicDoctorAppointments(
              data.clinicId,
              data.doctorId,
            );
          }
        }
      }
    } catch (error) {
      console.error("Error updating appointment status:", error);
      throw new Error("Failed to update appointment status");
    }
  },

  /**
   * Delete an appointment
   * @param {string} appointmentId - Appointment ID
   * @returns {Promise<void>}
   */
  async deleteAppointment(appointmentId: string): Promise<void> {
    try {
      const appointmentDoc = doc(db, "appointments", appointmentId);
      const appointmentSnap = await getDoc(appointmentDoc);

      await deleteDoc(appointmentDoc);

      if (appointmentSnap.exists()) {
        const data = appointmentSnap.data();

        if (data.clinicId) {
          cacheService.invalidateClinicAppointments(data.clinicId);
          if (data.doctorId) {
            cacheService.invalidateClinicDoctorAppointments(
              data.clinicId,
              data.doctorId,
            );
          }
        }
      }
    } catch (error) {
      console.error("Error deleting appointment:", error);
      throw new Error("Failed to delete appointment");
    }
  },

  /**
   * Get appointments by date range for a clinic
   * @param {string} clinicId - ID of the clinic
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Appointment[]>} - Array of appointments in the date range
   */
  async getAppointmentsByDateRange(
    _clinicId: string | undefined,
    startDate: Date,
    endDate: Date,
  ): Promise<Appointment[]> {
    try {
      const appointmentsCollection = collection(db, "appointments");

      // OPTION 2: Client-side filtering to avoid composite index requirements
      // We only query by clinicId which is an equality filter
      const constraints: any[] = [];

      if (_clinicId && _clinicId !== "standalone") {
        constraints.push(where("clinicId", "==", _clinicId));
      }
      // We remove the date range where() and orderBy() from the Firestore query
      // and handle them in memory to solve the index error immediately.
      const q = query(appointmentsCollection, ...constraints);

      const querySnapshot = await getDocs(q);
      const appointments: Appointment[] = [];

      querySnapshot.forEach((doc) => {
        appointments.push(mapAppointmentDoc(doc));
      });

      // Filter by date range in memory
      const filtered = appointments.filter((app) => {
        const date = app.appointmentDate;

        return date >= startDate && date <= endDate;
      });

      // Sort by date in memory
      return filtered.sort(
        (a, b) => a.appointmentDate.getTime() - b.appointmentDate.getTime(),
      );
    } catch (error) {
      console.error("Error fetching appointments by date range:", error);
      throw new Error("Failed to fetch appointments by date range");
    }
  },

  /**
   * Get upcoming appointments for a clinic (next 7 days)
   * @param {string} clinicId - ID of the clinic
   * @returns {Promise<Appointment[]>} - Array of upcoming appointments
   */
  async getUpcomingAppointments(
    _clinicId?: string,
  ): Promise<Appointment[]> {
    try {
      const today = new Date();
      const nextWeek = new Date();

      nextWeek.setDate(today.getDate() + 7);

      return await this.getAppointmentsByDateRange(
        _clinicId,
        today,
        nextWeek,
      );
    } catch (error) {
      console.error("Error fetching upcoming appointments:", error);
      throw new Error("Failed to fetch upcoming appointments");
    }
  },

  /**
   * Get today's appointments for a clinic
   * @param {string} clinicId - ID of the clinic
   * @returns {Promise<Appointment[]>} - Array of today's appointments
   */
  async getTodaysAppointments(
    _clinicId?: string,
  ): Promise<Appointment[]> {
    try {
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

      return await this.getAppointmentsByDateRange(
        _clinicId,
        startOfDay,
        endOfDay,
      );
    } catch (error) {
      console.error("Error fetching today's appointments:", error);
      throw new Error("Failed to fetch today's appointments");
    }
  },

  /**
   * Get appointments for a specific date for a clinic
   * @param {string} clinicId - ID of the clinic
   * @param {Date} date - Date to get appointments for
   * @returns {Promise<Appointment[]>} - Array of appointments for the date
   */
  async getAppointmentsByDate(
    date: Date,
    _clinicId?: string,
  ): Promise<Appointment[]> {
    try {
      const startOfDay = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
      );
      const endOfDay = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        23,
        59,
        59,
      );

      return await this.getAppointmentsByDateRange(
        _clinicId,
        startOfDay,
        endOfDay,
      );
    } catch (error) {
      console.error("Error fetching appointments by date:", error);
      throw new Error("Failed to fetch appointments by date");
    }
  },

  /**
   * Subscribe to clinic appointments (real-time updates)
   */
  subscribeToClinicAppointments(
    _clinicId: string | undefined,
    onData: AppointmentSnapshotHandler,
    onError?: AppointmentErrorHandler,
    /**
     * Bound the subscription to appointments dated within [start, end).
     * Without it every appointment the clinic has ever created streams to
     * the caller and is re-delivered on any write to any of them — fine for
     * a short-lived list, ruinous for a desk left open all day. The query
     * uses the existing (clinicId, appointmentDate DESC) composite index.
     */
    range?: { start: Date; end: Date },
  ) {
    // "standalone" is a deliberate sentinel for an intentionally unfiltered
    // subscription. Any other falsy value (undefined/"") is not — building an
    // unfiltered query in that case would silently leak cross-clinic
    // appointment data, so refuse instead of defaulting to unfiltered.
    if (!_clinicId) {
      console.error(
        "subscribeToClinicAppointments called without a clinicId — refusing to subscribe unfiltered.",
      );
      onError?.(new Error("clinicId is required to subscribe to appointments"));
      onData([]);

      return () => {};
    }

    const appointmentsCollection = collection(db, "appointments");
    const constraints: any[] = [];

    if (_clinicId !== "standalone") {
      constraints.push(where("clinicId", "==", _clinicId));
    }
    if (range) {
      constraints.push(
        where("appointmentDate", ">=", Timestamp.fromDate(range.start)),
        where("appointmentDate", "<", Timestamp.fromDate(range.end)),
        // A range filter needs an index that includes the field anyway; the
        // one this clinic already ships is (clinicId, appointmentDate DESC),
        // so order the same way to use it rather than demand a second one.
        orderBy("appointmentDate", "desc"),
      );
    }
    // Unbounded callers keep the index-free query; they sort in memory below.
    const q = query(appointmentsCollection, ...constraints);

    return onSnapshot(
      q,
      (snapshot) => {
        const nextAppointments: Appointment[] = [];

        snapshot.forEach((docSnap) => {
          nextAppointments.push(mapAppointmentDoc(docSnap));
        });
        // Sort by date descending in memory
        onData(
          nextAppointments.sort(
            (a, b) => b.appointmentDate.getTime() - a.appointmentDate.getTime(),
          ),
        );
      },
      (error) => {
        console.error("Appointments subscription error:", error);
        onError?.(error as Error);
      },
    );
  },

  /**
   * Subscribe to doctor appointments (real-time updates)
   */
  subscribeToDoctorAppointments(
    doctorId: string,
    clinicId: string,
    onData: AppointmentSnapshotHandler,
    onError?: AppointmentErrorHandler,
  ) {
    const appointmentsCollection = collection(db, "appointments");
    // clinicId has to be IN the query, not just implied: the security rule
    // authorises a read only when resource.data.clinicId matches the caller's
    // clinic, and Firestore rejects a listen it cannot prove is so limited.
    // Without it this subscription failed for every non-admin user, because
    // clinic-admin alone passes via the rule's super-admin branch.
    const constraints: any[] = [
      where("doctorId", "==", doctorId),
      where("clinicId", "==", clinicId),
    ];

    // Removed orderBy to avoid composite index requirement
    const q = query(appointmentsCollection, ...constraints);

    return onSnapshot(
      q,
      (snapshot) => {
        const nextAppointments: Appointment[] = [];

        snapshot.forEach((docSnap) => {
          nextAppointments.push(mapAppointmentDoc(docSnap));
        });
        // Sort by date descending in memory
        onData(
          nextAppointments.sort(
            (a, b) => b.appointmentDate.getTime() - a.appointmentDate.getTime(),
          ),
        );
      },
      (error) => {
        console.error("Doctor appointments subscription error:", error);
        onError?.(error as Error);
      },
    );
  },

  /**
   * Subscribe to expert appointments (real-time updates)
   */
  subscribeToExpertAppointments(
    expertId: string,
    clinicId: string,
    onData: AppointmentSnapshotHandler,
    onError?: AppointmentErrorHandler,
  ) {
    const appointmentsCollection = collection(db, "appointments");
    // See subscribeToDoctorAppointments — same rule constraint.
    const constraints: any[] = [
      where("assignedExpertId", "==", expertId),
      where("clinicId", "==", clinicId),
    ];

    // Removed orderBy to avoid composite index requirement
    const q = query(appointmentsCollection, ...constraints);

    return onSnapshot(
      q,
      (snapshot) => {
        const nextAppointments: Appointment[] = [];

        snapshot.forEach((docSnap) => {
          nextAppointments.push(mapAppointmentDoc(docSnap));
        });
        // Sort by date descending in memory
        onData(
          nextAppointments.sort(
            (a, b) => b.appointmentDate.getTime() - a.appointmentDate.getTime(),
          ),
        );
      },
      (error) => {
        console.error("Expert appointments subscription error:", error);
        onError?.(error as Error);
      },
    );
  },
};
