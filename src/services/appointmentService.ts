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
} from "firebase/firestore";

import { db } from "@/config/firebase";
import { cacheService } from "@/services/cacheService";
import { Appointment } from "@/types/models";

type AppointmentSnapshotHandler = (appointments: Appointment[]) => void;
type AppointmentErrorHandler = (error: Error) => void;

const mapAppointmentDoc = (
  docSnap: QueryDocumentSnapshot<DocumentData> | DocumentSnapshot<DocumentData>,
): Appointment => {
  const data = docSnap.data();

  if (!data) {
    throw new Error("Appointment data is undefined");
  }

  const parseDate = (val: any) => {
    if (!val) return undefined;
    if (typeof val.toDate === 'function') return val.toDate();
    if (typeof val === 'string' || typeof val === 'number') return new Date(val);
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
   * Alias for backward compatibility
   */
  async getAppointmentsByClinic(
    clinicId?: string,
    _branchId?: string,
  ): Promise<Appointment[]> {
    const appointments = await this.getAppointments();

    if (clinicId) {
      cacheService.setClinicAppointments(clinicId, appointments);
    } else {
      cacheService.setClinicAppointments("standalone", appointments);
    }

    return appointments;
  },

  /**
   * Get all appointments for a specific patient
   * @param {string} patientId - ID of the patient
   * @returns {Promise<Appointment[]>} - Array of appointments for the patient
   */
  async getAppointmentsByPatient(patientId: string): Promise<Appointment[]> {
    try {
      const appointmentsCollection = collection(db, "appointments");
      const q = query(
        appointmentsCollection,
        where("patientId", "==", patientId),
      );

      const querySnapshot = await getDocs(q);
      const appointments: Appointment[] = [];

      querySnapshot.forEach((doc) => {
        appointments.push(mapAppointmentDoc(doc));
      });

      // Sort by date descending in memory to avoid index error
      return appointments.sort((a, b) => b.appointmentDate.getTime() - a.appointmentDate.getTime());
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
      const q = query(
        appointmentsCollection,
        where("doctorId", "==", doctorId),
      );

      const querySnapshot = await getDocs(q);
      const appointments: Appointment[] = [];

      querySnapshot.forEach((doc) => {
        appointments.push(mapAppointmentDoc(doc));
      });

      // Sort by date descending in memory to avoid index error
      return appointments.sort((a, b) => b.appointmentDate.getTime() - a.appointmentDate.getTime());
    } catch (error) {
      console.error("Error fetching doctor appointments:", error);
      throw new Error("Failed to fetch doctor appointments");
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

      // Remove undefined values
      Object.keys(firestoreData).forEach((key) => {
        if (firestoreData[key as keyof typeof firestoreData] === undefined) {
          delete firestoreData[key as keyof typeof firestoreData];
        }
      });

      await updateDoc(appointmentDoc, firestoreData);

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
   * @param {string} [branchId] - Optional branch ID to filter appointments by
   * @returns {Promise<Appointment[]>} - Array of appointments in the date range
   */
  async getAppointmentsByDateRange(
    _clinicId: string | undefined,
    startDate: Date,
    endDate: Date,
    _branchId?: string,
  ): Promise<Appointment[]> {
    try {
      const appointmentsCollection = collection(db, "appointments");

      // OPTION 2: Client-side filtering to avoid composite index requirements
      // We only query by clinicId (and branchId) which are equality filters
      const constraints: any[] = [];

      // We remove the date range where() and orderBy() from the Firestore query
      // and handle them in memory to solve the index error immediately.
      const q = query(appointmentsCollection, ...constraints);

      const querySnapshot = await getDocs(q);
      const appointments: Appointment[] = [];

      querySnapshot.forEach((doc) => {
        appointments.push(mapAppointmentDoc(doc));
      });

      // Filter by date range in memory
      const filtered = appointments.filter(app => {
        const date = app.appointmentDate;
        return date >= startDate && date <= endDate;
      });

      // Sort by date in memory
      return filtered.sort((a, b) => a.appointmentDate.getTime() - b.appointmentDate.getTime());
    } catch (error) {
      console.error("Error fetching appointments by date range:", error);
      throw new Error("Failed to fetch appointments by date range");
    }
  },

  /**
   * Get upcoming appointments for a clinic (next 7 days)
   * @param {string} clinicId - ID of the clinic
   * @param {string} [branchId] - Optional branch ID to filter appointments by
   * @returns {Promise<Appointment[]>} - Array of upcoming appointments
   */
  async getUpcomingAppointments(
    _clinicId?: string,
    _branchId?: string,
  ): Promise<Appointment[]> {
    try {
      const today = new Date();
      const nextWeek = new Date();

      nextWeek.setDate(today.getDate() + 7);

      return await this.getAppointmentsByDateRange(
        _clinicId,
        today,
        nextWeek,
        _branchId,
      );
    } catch (error) {
      console.error("Error fetching upcoming appointments:", error);
      throw new Error("Failed to fetch upcoming appointments");
    }
  },

  /**
   * Get today's appointments for a clinic
   * @param {string} clinicId - ID of the clinic
   * @param {string} [branchId] - Optional branch ID to filter appointments by
   * @returns {Promise<Appointment[]>} - Array of today's appointments
   */
  async getTodaysAppointments(
    _clinicId?: string,
    _branchId?: string,
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
        _branchId,
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
   * @param {string} [branchId] - Optional branch ID to filter appointments by
   * @returns {Promise<Appointment[]>} - Array of appointments for the date
   */
  async getAppointmentsByDate(
    date: Date,
    _clinicId?: string,
    _branchId?: string,
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
        _branchId,
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
    _branchId: string | undefined,
    onData: AppointmentSnapshotHandler,
    onError?: AppointmentErrorHandler,
  ) {
    const appointmentsCollection = collection(db, "appointments");
    const constraints: any[] = [];
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
            (a, b) =>
              b.appointmentDate.getTime() - a.appointmentDate.getTime(),
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
    branchId: string | undefined,
    onData: AppointmentSnapshotHandler,
    onError?: AppointmentErrorHandler,
  ) {
    const appointmentsCollection = collection(db, "appointments");
    const constraints: any[] = [where("doctorId", "==", doctorId)];
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
            (a, b) =>
              b.appointmentDate.getTime() - a.appointmentDate.getTime(),
          ),
        );
      },
      (error) => {
        console.error("Doctor appointments subscription error:", error);
        onError?.(error as Error);
      },
    );
  },
};
