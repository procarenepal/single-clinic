import type { QueryDocumentSnapshot } from "firebase/firestore";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  addDoc,
  serverTimestamp,
  orderBy,
  limit,
  startAfter,
  getCountFromServer,
  deleteDoc,
} from "firebase/firestore";

import { db } from "../config/firebase";
import { Patient } from "../types/models";

import { cacheService } from "@/services/cacheService";
import { sendWelcomeSMS } from "@/services/sendMessageService";

const PATIENTS_COLLECTION = "patients";

/**
 * Strips country code (+977 / 977) and non-digit chars so that
 * "9706127862", "+9779706127862", and "9779706127862" all compare equal.
 */
function normalizeMobile(mobile: string): string {
  // Remove everything except digits
  let digits = mobile.replace(/\D/g, "");

  // Nepal country code: strip leading "977" if 13 digits total
  if (digits.startsWith("977") && digits.length === 13) {
    digits = digits.slice(3);
  }

  return digits;
}

/**
 * Service for managing patient data in Firestore
 */
export const patientService = {
  /**
   * Generate the next registration number
   * @returns {Promise<string>} - Next registration number in sequence
   */
  async getNextRegistrationNumber(clinicId?: string): Promise<string> {
    try {
      const patientsRef = collection(db, PATIENTS_COLLECTION);
      const constraints: any[] = [];

      if (clinicId && clinicId !== "standalone" && clinicId !== "default") {
        constraints.push(where("clinicId", "==", clinicId));
      }

      // 1) Prefer numeric ordering when available
      try {
        const qNumeric = query(
          patientsRef,
          ...constraints,
          orderBy("regNumberNumeric", "desc"),
          limit(1),
        );
        const snapNumeric = await getDocs(qNumeric);

        if (!snapNumeric.empty) {
          const last = snapNumeric.docs[0].data() as any;
          const lastNum =
            typeof last.regNumberNumeric === "number"
              ? last.regNumberNumeric
              : parseInt(String(last.regNumber || ""), 10);
          const next = isNaN(lastNum) ? 1 : lastNum + 1;

          return String(next);
        }
      } catch (e) {
        // Fallback if index missing or field not present
      }

      // 2) Fallback: fetch recent patients for this clinic and compute max
      const qRecent = query(
        patientsRef,
        ...constraints,
        orderBy("createdAt", "desc"),
        limit(50),
      );
      const recentSnap = await getDocs(qRecent);

      if (recentSnap.empty) {
        return "1001"; // Default starting number for new clinics
      }

      let maxReg = 0;

      recentSnap.forEach((docSnap) => {
        const data = docSnap.data() as any;
        const regStr = String(data.regNumber ?? "").trim();
        const parsed = parseInt(regStr, 10);

        if (!isNaN(parsed) && parsed > maxReg) maxReg = parsed;
        if (
          typeof data.regNumberNumeric === "number" &&
          data.regNumberNumeric > maxReg
        )
          maxReg = data.regNumberNumeric;
      });

      return String((maxReg || 1000) + 1);
    } catch (error) {
      console.error("Error generating next registration number:", error);

      return String(Math.floor(Math.random() * 9000) + 1000); // Absolute fallback
    }
  },

  /**
   * Create a new patient
   * @param {Partial<Patient>} patientData - Data for the new patient
   * @returns {Promise<string>} - ID of the created patient
   */
  async createPatient(patientData: Partial<Patient>): Promise<string> {
    try {
      const patientsRef = collection(db, PATIENTS_COLLECTION);
      const regNumberNumeric = patientData.regNumber
        ? parseInt(String(patientData.regNumber), 10)
        : undefined;

      // Filter out any undefined values to prevent Firestore unsupported field value: undefined errors
      const cleanData = { ...patientData };

      Object.keys(cleanData).forEach((key) => {
        if (cleanData[key as keyof typeof cleanData] === undefined) {
          delete cleanData[key as keyof typeof cleanData];
        }
      });

      const docRef = await addDoc(patientsRef, {
        ...cleanData,
        ...(regNumberNumeric && !isNaN(regNumberNumeric)
          ? { regNumberNumeric }
          : {}),
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Invalidate cache to ensure new patient appears in search immediately
      if (patientData.clinicId) {
        cacheService.invalidateClinicPatients(patientData.clinicId);
        // Also invalidate doctor-specific cache if patient has a doctorId
        if (patientData.doctorId) {
          cacheService.invalidateDoctorPatients(
            patientData.clinicId,
            patientData.doctorId,
          );
        }
      }

      // Trigger Welcome SMS
      if (patientData.mobile && patientData.clinicId) {
        // Run in background without blocking the UI
        sendWelcomeSMS({
          id: docRef.id,
          name: patientData.name || "Patient",
          mobile: patientData.mobile,
          clinicId: patientData.clinicId,
          branchId: (patientData as any).branchId,
        }).catch((err) => console.error("Auto-welcome SMS failed:", err));
      }

      return docRef.id;
    } catch (error) {
      console.error("Error creating patient:", error);
      throw error;
    }
  },

  /**
   * Get a patient by ID
   * @param {string} id - Patient ID
   * @returns {Promise<Patient | null>} - Patient data or null if not found
   */
  async getPatientById(id: string): Promise<Patient | null> {
    try {
      const docRef = doc(db, PATIENTS_COLLECTION, id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data() as any;
        // Convert Firebase Timestamp objects to JavaScript Date objects
        const createdAt = data.createdAt
          ? new Date(data.createdAt.seconds * 1000)
          : new Date(0);
        const updatedAt = data.updatedAt
          ? new Date(data.updatedAt.seconds * 1000)
          : new Date();
        const dob = data.dob ? new Date(data.dob.seconds * 1000) : undefined;
        const bsDate = data.bsDate
          ? new Date(data.bsDate.seconds * 1000)
          : undefined;

        return {
          id: docSnap.id,
          ...data,
          createdAt,
          updatedAt,
          dob,
          bsDate,
        } as Patient;
      }

      return null;
    } catch (error) {
      console.error("Error getting patient:", error);
      throw error;
    }
  },

  /**
   * Get all patients for a specific clinic.
   * Optionally scope by branch for branch-aware views.
   * @param {string} clinicId - ID of the clinic
   * @param {string} [branchId] - Optional branch ID to filter patients by
   * @returns {Promise<Patient[]>} - Array of patients for the clinic (ordered by registration number descending)
   */
  async getPatients(clinicId?: string): Promise<Patient[]> {
    try {
      const cacheKey = clinicId || "standalone";
      const cached = cacheService.getClinicPatients(cacheKey);

      if (cached) return cached as Patient[];

      const patientsRef = collection(db, PATIENTS_COLLECTION);
      const constraints: any[] = [];

      if (clinicId && clinicId !== "standalone" && clinicId !== "default") {
        constraints.push(where("clinicId", "==", clinicId));
      }
      const baseQ = query(patientsRef, ...constraints);

      // Fetch all patients for the clinic (or all if standalone)
      // We remove the database-level orderBy to avoid composite index requirements
      const querySnapshot = await getDocs(baseQ);
      const patients: Patient[] = [];

      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data() as any;
        const createdAt = data.createdAt
          ? new Date(data.createdAt.seconds * 1000)
          : new Date(0);
        const updatedAt = data.updatedAt
          ? new Date(data.updatedAt.seconds * 1000)
          : new Date();
        const dob = data.dob ? new Date(data.dob.seconds * 1000) : undefined;
        const bsDate = data.bsDate
          ? new Date(data.bsDate.seconds * 1000)
          : undefined;

        patients.push({
          id: docSnap.id,
          ...data,
          createdAt,
          updatedAt,
          dob,
          bsDate,
        } as Patient);
      });

      // Sort in-memory by regNumber (descending)
      patients.sort((a, b) => {
        const aVal = (a as any).regNumberNumeric ?? 0;
        const bVal = (b as any).regNumberNumeric ?? 0;

        if (bVal !== aVal) return bVal - aVal;

        return (b.regNumber || "").localeCompare(a.regNumber || "");
      });

      cacheService.setClinicPatients(cacheKey, patients);

      return patients;
    } catch (error) {
      console.error("Error getting patients:", error);
      throw error;
    }
  },

  /**
   * Alias for backward compatibility
   */
  async getPatientsByClinic(
    clinicId?: string,
    _branchId?: string,
  ): Promise<Patient[]> {
    return this.getPatients(clinicId);
  },

  /**
   * Update a patient's information
   * @param {string} id - Patient ID
   * @param {Partial<Patient>} updateData - Updated patient data
   * @returns {Promise<void>}
   */
  async updatePatient(
    id: string,
    updateData: Partial<Patient> | Record<string, any>,
  ): Promise<void> {
    try {
      // Get patient data before update to know clinicId and doctorId for cache invalidation
      const existingPatient = await this.getPatientById(id);
      const clinicId =
        existingPatient?.clinicId || (updateData as any).clinicId;
      const oldDoctorId = existingPatient?.doctorId;
      const newDoctorId = (updateData as any).doctorId;

      // Filter out undefined values as Firebase doesn't support them
      const cleanedUpdateData = Object.fromEntries(
        Object.entries(updateData).filter(([_, value]) => value !== undefined),
      );

      const docRef = doc(db, PATIENTS_COLLECTION, id);

      await updateDoc(docRef, {
        ...cleanedUpdateData,
        updatedAt: serverTimestamp(),
      });

      // Invalidate cache to ensure updated patient appears correctly in search
      if (clinicId) {
        cacheService.invalidateClinicPatients(clinicId);
        // Invalidate old doctor cache if doctor changed
        if (oldDoctorId) {
          cacheService.invalidateDoctorPatients(clinicId, oldDoctorId);
        }
        // Invalidate new doctor cache if doctor changed
        if (newDoctorId && newDoctorId !== oldDoctorId) {
          cacheService.invalidateDoctorPatients(clinicId, newDoctorId);
        }
      }
    } catch (error) {
      console.error("Error updating patient:", error);
      throw error;
    }
  },

  /**
   * Delete a patient (hard delete - permanently removes the document)
   * @param {string} id - Patient ID to delete
   * @returns {Promise<void>}
   */
  async deletePatient(id: string): Promise<void> {
    try {
      // Get patient data before delete to know clinicId and doctorId for cache invalidation
      const existingPatient = await this.getPatientById(id);
      const clinicId = existingPatient?.clinicId;
      const doctorId = existingPatient?.doctorId;

      const docRef = doc(db, PATIENTS_COLLECTION, id);

      await deleteDoc(docRef); // Hard delete

      // Invalidate cache to ensure deleted patient is removed from search
      if (clinicId) {
        cacheService.invalidateClinicPatients(clinicId);
        if (doctorId) {
          cacheService.invalidateDoctorPatients(clinicId, doctorId);
        }
      }
    } catch (error) {
      console.error("Error deleting patient:", error);
      throw error;
    }
  },

  /**
   * Search patients by name, email, or phone for a specific clinic
   * @param {string} clinicId - ID of the clinic
   * @param {string} searchTerm - Search term
   * @returns {Promise<Patient[]>} - Array of matching patients
   */
  async searchPatients(
    _clinicId: string,
    searchTerm: string,
  ): Promise<Patient[]> {
    try {
      const allPatients = await this.getPatients();
      const lowerSearchTerm = searchTerm.toLowerCase();

      return allPatients.filter(
        (patient) =>
          patient.name.toLowerCase().includes(lowerSearchTerm) ||
          patient.email?.toLowerCase().includes(lowerSearchTerm) ||
          patient.mobile.includes(searchTerm) ||
          patient.phone?.includes(searchTerm) ||
          patient.regNumber.includes(searchTerm),
      );
    } catch (error) {
      console.error("Error searching patients:", error);
      throw error;
    }
  },

  /**
   * Get patients by doctor for a specific clinic.
   * Optionally scope by branch for branch-aware views.
   * @param {string} clinicId - ID of the clinic
   * @param {string} doctorId - ID of the doctor
   * @param {string} [branchId] - Optional branch ID to filter by
   * @returns {Promise<Patient[]>} - Array of patients assigned to the doctor
   */
  async getPatientsByDoctor(
    doctorId: string,
    _clinicId?: string,
  ): Promise<Patient[]> {
    try {
      const patientsRef = collection(db, PATIENTS_COLLECTION);
      const q = query(patientsRef, where("doctorId", "==", doctorId));
      const querySnapshot = await getDocs(q);

      const patients: Patient[] = [];

      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const createdAt = data.createdAt
          ? new Date(data.createdAt.seconds * 1000)
          : new Date(0);
        const updatedAt = data.updatedAt
          ? new Date(data.updatedAt.seconds * 1000)
          : new Date();
        const dob = data.dob ? new Date(data.dob.seconds * 1000) : undefined;
        const bsDate = data.bsDate
          ? new Date(data.bsDate.seconds * 1000)
          : undefined;

        patients.push({
          id: docSnap.id,
          ...data,
          createdAt,
          updatedAt,
          dob,
          bsDate,
        } as Patient);
      });

      return patients;
    } catch (error) {
      console.error("Error getting patients by doctor:", error);
      throw error;
    }
  },

  /**
   * Get patients by expert for a specific clinic.
   * @param {string} expertId - ID of the expert
   * @param {string} [_clinicId] - Optional clinic ID
   * @returns {Promise<Patient[]>} - Array of patients assigned to the expert
   */
  async getPatientsByExpert(
    expertId: string,
    _clinicId?: string,
  ): Promise<Patient[]> {
    try {
      const patientsRef = collection(db, PATIENTS_COLLECTION);
      const q1 = query(patientsRef, where("assignedExpertId", "==", expertId));
      const q2 = query(patientsRef, where("doctorId", "==", expertId));

      const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);

      const map = new Map<string, Patient>();

      const processSnap = (snap: any) => {
        snap.forEach((docSnap: any) => {
          const data = docSnap.data();
          const createdAt = data.createdAt
            ? new Date(data.createdAt.seconds * 1000)
            : new Date(0);
          const updatedAt = data.updatedAt
            ? new Date(data.updatedAt.seconds * 1000)
            : new Date();
          const dob = data.dob ? new Date(data.dob.seconds * 1000) : undefined;
          const bsDate = data.bsDate
            ? new Date(data.bsDate.seconds * 1000)
            : undefined;

          map.set(docSnap.id, {
            id: docSnap.id,
            ...data,
            createdAt,
            updatedAt,
            dob,
            bsDate,
          } as Patient);
        });
      };

      processSnap(snap1);
      processSnap(snap2);

      return Array.from(map.values()).sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      );
    } catch (error) {
      console.error("Error getting patients by expert:", error);
      throw error;
    }
  },

  /**
   * Paginated patients for a clinic with optional filters.
   * Does not use cache; always fetches fresh from Firestore.
   * @param clinicId - ID of the clinic
   * @param options - pageSize, lastDoc (cursor), doctorId, searchPrefix, gender, isCritical
   * @returns { patients, lastDoc }
   */
  async getPatientsByClinicPaginated(
    _clinicId?: string,
    options: {
      pageSize: number;
      lastDoc?: QueryDocumentSnapshot | null;
      doctorId?: string;
      expertId?: string;
      searchPrefix?: string;
      gender?: string;
      isCritical?: boolean;
      branchId?: string;
    } = {} as any,
  ): Promise<{ patients: Patient[]; lastDoc: QueryDocumentSnapshot | null }> {
    const {
      pageSize,
      lastDoc,
      doctorId,
      expertId,
      searchPrefix,
      gender,
      isCritical,
      branchId,
    } = options;
    const prefix = searchPrefix?.trim();
    const hasNameSearch = Boolean(prefix);

    if (import.meta.env.DEV) {
      console.log(
        "%c[PatientsSearch:service] getPatientsByClinicPaginated",
        "color: #0d9488",
        {
          clinicId: _clinicId,
          searchPrefix: searchPrefix ?? "(none)",
          prefix: prefix ?? "(none)",
          hasNameSearch,
          gender,
          isCritical,
          pageSize,
          hasCursor: !!lastDoc,
        },
      );
    }

    const patientsRef = collection(db, PATIENTS_COLLECTION);

    const baseConstraints: any[] = [];

    if (_clinicId) baseConstraints.push(where("clinicId", "==", _clinicId));
    if (branchId) baseConstraints.push(where("branchId", "==", branchId));
    if (doctorId) baseConstraints.push(where("doctorId", "==", doctorId));
    if (expertId)
      baseConstraints.push(where("assignedExpertId", "==", expertId));
    if (gender) baseConstraints.push(where("gender", "==", gender));
    if (isCritical === true)
      baseConstraints.push(where("isCritical", "==", true));
    if (isCritical === false)
      baseConstraints.push(where("isCritical", "==", false));

    let q: any;

    if (hasNameSearch) {
      baseConstraints.push(where("name", ">=", prefix));
      baseConstraints.push(where("name", "<=", prefix + "\uf8ff"));
      baseConstraints.push(orderBy("name"));
      q = query(patientsRef, ...baseConstraints);
    } else {
      try {
        baseConstraints.push(orderBy("regNumberNumeric", "desc"));
        const probeQ = query(patientsRef, ...baseConstraints, limit(1));
        const probeSnap = await getDocs(probeQ);

        if (probeSnap.empty) {
          throw new Error(
            "No numeric sequence field found, fallback to string",
          );
        }
        q = query(patientsRef, ...baseConstraints);
      } catch {
        baseConstraints.pop(); // remove regNumberNumeric orderBy
        try {
          baseConstraints.push(orderBy("regNumber", "desc"));
          const probeQ2 = query(patientsRef, ...baseConstraints, limit(1));

          await getDocs(probeQ2);
          q = query(patientsRef, ...baseConstraints);
        } catch {
          baseConstraints.pop(); // remove regNumber orderBy
          q = query(patientsRef, ...baseConstraints); // Ultimate fallback: no sorting
        }
      }
    }

    const paginatedQ = lastDoc
      ? query(q, startAfter(lastDoc), limit(pageSize))
      : query(q, limit(pageSize));
    const snapshot = await getDocs(paginatedQ);

    const patients: Patient[] = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as any;
      const createdAt = data.createdAt
        ? new Date(data.createdAt.seconds * 1000)
        : new Date(0);
      const updatedAt = data.updatedAt
        ? new Date(data.updatedAt.seconds * 1000)
        : new Date();
      const dob = data.dob ? new Date(data.dob.seconds * 1000) : undefined;
      const bsDate = data.bsDate
        ? new Date(data.bsDate.seconds * 1000)
        : undefined;

      patients.push({
        id: docSnap.id,
        ...data,
        createdAt,
        updatedAt,
        dob,
        bsDate,
      } as Patient);
    });

    const last =
      snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;

    if (import.meta.env.DEV) {
      console.log(
        "%c[PatientsSearch:service] getPatientsByClinicPaginated result",
        "color: #0d9488",
        {
          searchPrefix: searchPrefix ?? "(none)",
          returnedCount: patients.length,
        },
      );
    }

    return { patients, lastDoc: last };
  },

  /**
   * Get total count of patients for a clinic with the same filters as getPatientsByClinicPaginated.
   */
  async getPatientsCountByClinic(
    _clinicId?: string,
    options: {
      doctorId?: string;
      expertId?: string;
      searchPrefix?: string;
      gender?: string;
      isCritical?: boolean;
      branchId?: string;
    } = {} as any,
  ): Promise<number> {
    const { doctorId, expertId, searchPrefix, gender, isCritical, branchId } =
      options as {
        doctorId?: string;
        expertId?: string;
        searchPrefix?: string;
        gender?: string;
        isCritical?: boolean;
        branchId?: string;
      };
    const prefix = searchPrefix?.trim();
    const hasNameSearch = Boolean(prefix);

    if (
      typeof window !== "undefined" &&
      (window as any).__DEBUG_PATIENTS_SEARCH
    ) {
      console.log("[PatientsSearch:service] getPatientsCountByClinic", {
        searchPrefix: searchPrefix ?? "(none)",
        hasNameSearch,
      });
    }

    const patientsRef = collection(db, PATIENTS_COLLECTION);

    const baseConstraints: any[] = [];

    if (_clinicId) baseConstraints.push(where("clinicId", "==", _clinicId));
    if (branchId) baseConstraints.push(where("branchId", "==", branchId));
    if (doctorId) baseConstraints.push(where("doctorId", "==", doctorId));
    if (expertId)
      baseConstraints.push(where("assignedExpertId", "==", expertId));
    if (gender) baseConstraints.push(where("gender", "==", gender));
    if (isCritical === true)
      baseConstraints.push(where("isCritical", "==", true));
    if (isCritical === false)
      baseConstraints.push(where("isCritical", "==", false));

    let q: any;

    if (hasNameSearch) {
      baseConstraints.push(where("name", ">=", prefix));
      baseConstraints.push(where("name", "<=", prefix + "\uf8ff"));
      baseConstraints.push(orderBy("name"));
      q = query(patientsRef, ...baseConstraints);
    } else {
      try {
        baseConstraints.push(orderBy("regNumberNumeric", "desc"));
        q = query(patientsRef, ...baseConstraints);
        const countSnap = await getCountFromServer(q);
        const count = countSnap.data().count;

        if (count === 0) {
          throw new Error(
            "Numeric sequence count is 0, trying string fallback",
          );
        }

        return count;
      } catch {
        baseConstraints.pop();
        try {
          baseConstraints.push(orderBy("regNumber", "desc"));
          q = query(patientsRef, ...baseConstraints);
          const countSnap = await getCountFromServer(q);

          return countSnap.data().count;
        } catch {
          baseConstraints.pop();
          q = query(patientsRef, ...baseConstraints);
        }
      }
    }

    const countSnap = await getCountFromServer(q);
    const count = countSnap.data().count;

    if (import.meta.env.DEV) {
      console.log(
        "%c[PatientsSearch:service] getPatientsCountByClinic result",
        "color: #0d9488",
        {
          searchPrefix: searchPrefix ?? "(none)",
          count,
        },
      );
    }

    return count;
  },
  /**
   * Check if a mobile number already exists in a specific clinic.
   * Normalizes the number by stripping +977/977 prefix so that
   * "9706127862" and "+9779706127862" are treated as the same number.
   * @param {string} mobile - Mobile number to check
   * @param {string} clinicId - ID of the clinic to check within
   * @param {string} [excludeId] - Optional patient ID to exclude from check (for updates)
   * @returns {Promise<boolean>} - True if mobile exists
   */
  async checkMobileExists(
    mobile: string,
    clinicId: string,
    excludeId?: string,
  ): Promise<boolean> {
    if (!mobile || !clinicId) return false;
    try {
      const normalized = normalizeMobile(mobile);
      // Build variants to check: both the raw digits and the +977 version
      const variants = Array.from(
        new Set([
          normalized,
          "+977" + normalized,
          "977" + normalized,
          mobile.trim(),
        ]),
      );

      for (const variant of variants) {
        const q = query(
          collection(db, PATIENTS_COLLECTION),

          where("mobile", "==", variant),
        );
        const snap = await getDocs(q);

        if (!snap.empty) {
          if (excludeId) {
            if (snap.docs.some((d) => d.id !== excludeId)) return true;
          } else {
            return true;
          }
        }
      }

      return false;
    } catch (error) {
      console.error("Error checking mobile existence:", error);

      return false;
    }
  },

  /**
   * Check if an email already exists in a specific clinic
   * @param {string} email - Email address to check
   * @param {string} clinicId - ID of the clinic to check within
   * @param {string} [excludeId] - Optional patient ID to exclude from check (for updates)
   * @returns {Promise<boolean>} - True if email exists
   */
  async checkEmailExists(
    email: string,
    clinicId: string,
    excludeId?: string,
  ): Promise<boolean> {
    if (!email || !clinicId) return false;
    try {
      const q = query(
        collection(db, PATIENTS_COLLECTION),

        where("email", "==", email.trim().toLowerCase()),
      );
      const snap = await getDocs(q);

      if (snap.empty) return false;
      if (excludeId) {
        return snap.docs.some((doc) => doc.id !== excludeId);
      }

      return true;
    } catch (error) {
      console.error("Error checking email existence:", error);

      return false;
    }
  },
};

// Helper: Evaluate whether cached patient list should be bypassed
// We bypass if we detect obviously wrong DOBs (e.g., set to "today") and missing ages
// which can happen if older code defaulted DOB to current date.
(patientService as any).shouldBypassPatientsCache = (
  patients: Patient[],
): boolean => {
  try {
    const now = new Date();
    const oneDayMs = 24 * 60 * 60 * 1000;

    for (const p of patients) {
      const hasBadDob =
        p.dob instanceof Date &&
        Math.abs(now.getTime() - p.dob.getTime()) < oneDayMs;
      const missingAge =
        !(typeof (p as any).age === "number" && (p as any).age > 0) &&
        typeof (p as any).age !== "string";

      if (hasBadDob && missingAge) return true;
    }

    return false;
  } catch {
    return false;
  }
};
