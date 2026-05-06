import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  setDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  increment,
  Timestamp,
  runTransaction,
} from "firebase/firestore";

import { db } from "../config/firebase";

// Collection names following the established project patterns
const SMS_LOGS_COLLECTION = "smsLogs";
const SMS_TEMPLATES_COLLECTION = "smsTemplates";
const SMS_SETTINGS_COLLECTION = "smsSettings";
const APPOINTMENTS_COLLECTION = "appointments";
const PATIENTS_COLLECTION = "patients";
const DOCTORS_COLLECTION = "doctors";
const CLINICS_COLLECTION = "clinics";
const CLINIC_SETTINGS_COLLECTION = "clinicSettings";

// Enhanced interfaces aligned with existing patterns
export interface SMSResponse {
  response?: string;
  isRawText?: boolean;
  status?: string;
  message?: string;
  success?: boolean;
}

export interface SMSLog {
  id: string;
  clinicId: string;
  branchId?: string;
  patientId?: string;
  doctorId?: string;
  patientName?: string;
  doctorName?: string;
  patientPhone?: string;
  doctorPhone?: string;
  message: string;
  status: "sent" | "failed" | "pending";
  type: "reminder" | "manual" | "template" | "appointment";
  templateId?: string;
  recipientType?: "patient" | "doctor" | "general";
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface SMSTemplate {
  id?: string;
  clinicId: string;
  name: string;
  message: string;
  type: "patient" | "doctor" | "general" | "appointment" | "reminder";
  language?: "en" | "ne";
  isActive: boolean;
  usageCount?: number;
  createdAt: any;
  updatedAt: any;
  createdBy: string;
  updatedBy: string;
}

export interface SMSSettings {
  id: string;
  clinicId: string;
  branchId?: string | null;
  apiKey: string;
  senderId: string;
  apiUrl: string;
  enableReminders: boolean;
  reminderHours: number;
  maxDailySMS: number;
  currentDailySMS: number;
  lastResetDate: string;
  enableAutoReminders: boolean;
  smsAppointmentTypes?: string[];
  defaultSenderId?: string;
  customApiUrl?: string;
  smsBalance?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  updatedBy: string;
}

export interface SMSProvider {
  id: string;
  name: string;
  apiUrl: string;
  requiresAuth: boolean;
  isActive: boolean;
}

/**
 * Enhanced SMS Service with robust error handling and consistent patterns
 * Following established project conventions for error handling, logging, and data management
 */
export const smsService = {
  /**
   * Send SMS message using configured provider
   */
  async sendMessage(
    phoneNumber: string,
    message: string,
    settings?: Partial<SMSSettings>,
  ): Promise<SMSResponse> {
    try {
      // Validate inputs
      if (!phoneNumber || !message) {
        throw new Error("Phone number and message are required");
      }

      // Use provided settings or environment variables
      const apiKey = settings?.apiKey || import.meta.env.VITE_SMS_API_KEY || "";
      const senderId = settings?.senderId || settings?.defaultSenderId || import.meta.env.VITE_SMS_SENDER_ID || "";
      const apiUrl = settings?.apiUrl || settings?.customApiUrl || import.meta.env.VITE_SMS_API_URL || "";

      // Clean and validate phone number
      const cleanPhoneNumber = phoneNumber.replace(/\D/g, "");

      if (cleanPhoneNumber.length < 10) {
        throw new Error("Invalid phone number format");
      }

      // Prepare form data
      const formData = new URLSearchParams();

      formData.append("key", apiKey);
      formData.append("contacts", cleanPhoneNumber);
      formData.append("senderid", senderId);
      formData.append("msg", message);

      // Send SMS request
      const response = await fetch(apiUrl, {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData,
      });

      const responseText = await response.text();

      // Parse response
      let data: SMSResponse;

      try {
        data = JSON.parse(responseText);
        data.success = true;
      } catch (e) {
        data = {
          response: responseText,
          isRawText: true,
          success:
            responseText.includes("success") || responseText.includes("sent"),
        };
      }

      return data;
    } catch (error) {
      console.error("Error sending SMS:", error);
      throw error;
    }
  },

  /**
   * Get live SMS credit balance from provider
   */
  async getSMSBalance(apiKey?: string, apiUrl?: string): Promise<number | null> {
    try {
      const key = apiKey || import.meta.env.VITE_SMS_API_KEY;
      const url = apiUrl || import.meta.env.VITE_SMS_API_URL;

      if (!key || !url) return null;

      // Expanded list of common credit check endpoints for various providers
      const endpoints = [
        url.replace(/\/smsapi\/?$/, "/smsapi/index.php"), // Samaya SMS potential pattern
        url.replace(/\/sms\/?$/, "/credit/"),     // Sparrow SMS pattern
        url.replace(/\/sms\/?$/, "/balance/"),    // Alternative Sparrow/Generic
        url.replace(/\/v2\/sms\/?$/, "/v2/balance"), // Aakash SMS v2/v3 pattern
        "https://api.sparrowsms.com/v2/credit/",
        "https://v3.aakashsms.com/api/v2/balance",
        "https://your-sms-api.com/smsapi/index.php"
      ];

      for (const creditUrl of endpoints) {
        try {
          // Try direct fetch first
          const targetUrl = `${creditUrl}${creditUrl.includes("?") ? "&" : "?"}token=${key}&auth_token=${key}`;

          const attemptFetch = async (url: string, timeout = 10000) => {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), timeout);
            try {
              const res = await fetch(url, {
                signal: controller.signal,
                headers: { "Accept": "application/json" }
              });
              clearTimeout(id);
              return res;
            } catch (e) {
              clearTimeout(id);
              return null;
            }
          };

          let response = await attemptFetch(targetUrl);

          // If direct failed or was blocked, try via proxy
          if (!response || !response.ok) {
            const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
            const proxyResponse = await attemptFetch(proxyUrl);
            if (proxyResponse && proxyResponse.ok) {
              const proxyData = await proxyResponse.json();
              // AllOrigins wraps the response in a 'contents' field
              if (proxyData.contents) {
                try {
                  const data = JSON.parse(proxyData.contents);
                  const balance = data.credits ?? data.credit ?? data.balance ?? data.amount ?? data.available_balance;
                  if (balance !== undefined && balance !== null) return Number(balance);
                } catch (e) {
                  // If content isn't JSON, it might be raw text balance
                  const rawVal = parseFloat(proxyData.contents);
                  if (!isNaN(rawVal)) return rawVal;
                }
              }
            }
          }

          if (response && response.ok) {
            const data = await response.json();
            const balance = data.credits ?? data.credit ?? data.balance ?? data.amount ?? data.available_balance;
            if (balance !== undefined && balance !== null) return Number(balance);
          }
        } catch (e) {
          continue;
        }
      }

      return null;
    } catch (error) {
      console.error("Error fetching SMS balance:", error);
      return null;
    }
  },

  /**
   * Send appointment reminders for tomorrow's appointments
   */
  async sendAppointmentReminders(): Promise<void> {
    try {
      const tomorrow = new Date();

      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const endOfTomorrow = new Date(tomorrow);

      endOfTomorrow.setHours(23, 59, 59, 999);

      const appointmentsQuery = query(
        collection(db, APPOINTMENTS_COLLECTION),
        where("appointmentDate", ">=", Timestamp.fromDate(tomorrow)),
        where("appointmentDate", "<=", Timestamp.fromDate(endOfTomorrow)),
        where("status", "==", "Waiting"),
      );

      const querySnapshot = await getDocs(appointmentsQuery);

      // Group appointments by clinic for efficient processing
      const appointmentsByClinic: Record<string, any[]> = {};

      querySnapshot.forEach((doc) => {
        const appointment = { id: doc.id, ...doc.data() } as any;
        const clinicId = appointment.clinicId || appointment.clinicID;

        if (clinicId) {
          if (!appointmentsByClinic[clinicId]) {
            appointmentsByClinic[clinicId] = [];
          }
          appointmentsByClinic[clinicId].push(appointment);
        }
      });

      // Process each clinic's appointments
      const processingPromises = Object.entries(appointmentsByClinic).map(
        ([clinicId, appointments]) =>
          this.processClinicAppointmentReminders(clinicId, appointments).catch(
            (error) => {
              console.error(
                `Error processing reminders for clinic ${clinicId}:`,
                error,
              );
            },
          ),
      );

      await Promise.allSettled(processingPromises);
    } catch (error) {
      console.error("Error sending appointment reminders:", error);
      throw error;
    }
  },

  /**
   * Process appointment reminders for a specific clinic
   */
  async processClinicAppointmentReminders(
    clinicId: string,
    appointments: any[],
  ): Promise<void> {
    try {
      const [settingsDoc, clinicDoc] = await Promise.all([
        getDoc(doc(db, CLINIC_SETTINGS_COLLECTION, clinicId)),
        getDoc(doc(db, CLINICS_COLLECTION, clinicId)),
      ]);

      if (!settingsDoc.exists() || !clinicDoc.exists()) {
        console.warn(`Missing settings or clinic data for clinic ${clinicId}`);

        return;
      }

      const settings = settingsDoc.data();
      const clinic = clinicDoc.data();
      const clinicName = clinic.hospitalName || clinic.name || "Your Clinic";
      const smsSettings = await this.getSMSSettings(clinicId);

      if (!smsSettings?.enableReminders) {
        console.log(`SMS reminders disabled for clinic ${clinicId}`);

        return;
      }

      // Process appointments with better error handling
      const processingPromises = appointments.map((appointment) =>
        this.processIndividualAppointmentReminder(
          appointment,
          clinicId,
          clinicName,
          smsSettings,
        ).catch((error) => {
          console.error(
            `Error processing reminder for appointment ${appointment.id}:`,
            error,
          );

          // Continue processing other appointments
          return this.createSMSLog({
            clinicId,
            message: `Failed to send reminder for appointment ${appointment.id}`,
            status: "failed",
            type: "reminder",
            errorMessage:
              error instanceof Error ? error.message : "Unknown error",
            createdBy: "system",
          }).catch((logError) => {
            console.error("Error creating SMS log:", logError);
          });
        }),
      );

      await Promise.allSettled(processingPromises);
    } catch (error) {
      console.error(`Error in processClinicAppointmentReminders:`, error);
      throw error;
    }
  },

  /**
   * Process individual appointment reminder with efficient data fetching
   */
  async processIndividualAppointmentReminder(
    appointment: any,
    clinicId: string,
    clinicName: string,
    smsSettings: SMSSettings,
  ): Promise<void> {
    try {
      // Filter by appointment type if configured
      if (
        smsSettings.smsAppointmentTypes &&
        smsSettings.smsAppointmentTypes.length > 0
      ) {
        const appType = appointment.appointmentType || appointment.type;

        if (!smsSettings.smsAppointmentTypes.includes(appType)) {
          return; // Skip if type not in enabled list
        }
      }

      const patientId = appointment.patientId || appointment.patientID;
      const doctorId = appointment.doctorId || appointment.doctorID;

      // Fetch patient and doctor data in parallel
      const [patientDoc, doctorDoc] = await Promise.all([
        getDoc(doc(db, PATIENTS_COLLECTION, patientId)),
        getDoc(doc(db, DOCTORS_COLLECTION, doctorId)),
      ]);

      if (!patientDoc.exists()) {
        throw new Error(`Patient not found: ${patientId}`);
      }

      const patient = patientDoc.data();
      const phoneNumber = patient.mobile || patient.phone;

      if (!phoneNumber) {
        throw new Error(`No phone number found for patient ${patient.name}`);
      }

      const doctorName = doctorDoc.exists()
        ? doctorDoc.data().name
        : "your doctor";

      // Format appointment date
      const appointmentDate =
        appointment.appointmentDate instanceof Timestamp
          ? appointment.appointmentDate.toDate().toLocaleDateString()
          : appointment.appointmentDate;

      const message = `Reminder: Your appointment is scheduled for tomorrow ${appointmentDate} at ${appointment.appointmentTime || appointment.engageTime} with Dr. ${doctorName} at ${clinicName}.`;

      // Send SMS
      const response = await this.sendMessage(
        phoneNumber,
        message,
        smsSettings,
      );
      const isSuccess = response.success || response.isRawText;

      // Use transaction for atomic updates
      await runTransaction(db, async (transaction) => {
        // Create SMS log
        const logRef = doc(collection(db, SMS_LOGS_COLLECTION));
        const logData = {
          clinicId,
          patientId,
          patientName: patient.name,
          patientPhone: phoneNumber,
          message,
          status: isSuccess ? "sent" : "failed",
          type: "reminder",
          createdBy: "system",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        // Only add error message if there is an error
        if (!isSuccess) {
          logData["errorMessage"] = "SMS sending failed";
        }

        transaction.set(logRef, logData);

        // Update clinic SMS count
        const clinicRef = doc(db, CLINICS_COLLECTION, clinicId);

        transaction.update(clinicRef, {
          smsCount: increment(1),
        });

        // Update daily SMS count
        const settingsRef = doc(db, SMS_SETTINGS_COLLECTION, clinicId);

        transaction.update(settingsRef, {
          currentDailySMS: increment(1),
        });
      });
    } catch (error) {
      console.error("Error in processIndividualAppointmentReminder:", error);
      throw error;
    }
  },

  /**
   * Get SMS logs for a clinic with optional branch filtering
   */
  async getSMSLogs(
    clinicId: string,
    branchId?: string,
    limitCount = 50,
  ): Promise<SMSLog[]> {
    try {
      let q = query(
        collection(db, SMS_LOGS_COLLECTION),
        where("clinicId", "==", clinicId),
        limit(limitCount),
      );

      if (branchId) {
        q = query(
          collection(db, SMS_LOGS_COLLECTION),
          where("clinicId", "==", clinicId),
          where("branchId", "==", branchId),
          limit(limitCount),
        );
      }

      const querySnapshot = await getDocs(q);

      // Sort client-side by createdAt descending (avoids composite index requirement)
      return querySnapshot.docs
        .map((doc) => {
          const data = doc.data();

          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
          } as SMSLog;
        })
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error) {
      console.error("Error fetching SMS logs:", error);
      throw error;
    }
  },

  /**
   * Create a new SMS log entry
   */
  async createSMSLog(
    logData: Omit<SMSLog, "id" | "createdAt" | "updatedAt">,
  ): Promise<string> {
    try {
      // Filter out undefined values to prevent Firestore errors
      const cleanLogData = Object.fromEntries(
        Object.entries(logData).filter(([_, value]) => value !== undefined),
      );

      // 1. Create the log
      const logRef = await addDoc(collection(db, SMS_LOGS_COLLECTION), {
        ...cleanLogData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 2. If status is 'sent', increment the daily counter in settings
      if (cleanLogData.status === "sent") {
        const settingsRef = doc(db, SMS_SETTINGS_COLLECTION, cleanLogData.clinicId);
        const settingsSnap = await getDoc(settingsRef);

        if (settingsSnap.exists()) {
          const currentCount = settingsSnap.data().currentDailySMS || 0;
          await updateDoc(settingsRef, {
            currentDailySMS: currentCount + 1,
            updatedAt: serverTimestamp()
          });
        }
      }

      return logRef.id;
    } catch (error) {
      console.error("Error creating SMS log:", error);
      throw error;
    }
  },

  /**
   * Get SMS templates for a clinic
   */
  async getSMSTemplates(
    clinicId: string,
    branchId?: string,
  ): Promise<SMSTemplate[]> {
    try {
      const q = branchId
        ? query(
          collection(db, SMS_TEMPLATES_COLLECTION),
          where("clinicId", "==", clinicId),
          where("branchId", "==", branchId),
          where("isActive", "==", true),
        )
        : query(
          collection(db, SMS_TEMPLATES_COLLECTION),
          where("clinicId", "==", clinicId),
          where("isActive", "==", true),
        );

      const querySnapshot = await getDocs(q);

      const templates = querySnapshot.docs.map((doc) => {
        const data = doc.data();

        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        };
      }) as SMSTemplate[];

      // Sort in-memory to avoid index requirement
      return templates.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } catch (error) {
      console.error("Error fetching SMS templates:", error);
      throw error;
    }
  },

  /**
   * Create a new SMS template
   */
  async createSMSTemplate(
    templateData: Omit<
      SMSTemplate,
      "id" | "createdAt" | "updatedAt" | "usageCount"
    >,
  ): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, SMS_TEMPLATES_COLLECTION), {
        ...templateData,
        usageCount: 0,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return docRef.id;
    } catch (error) {
      console.error("Error creating SMS template:", error);
      throw error;
    }
  },

  /**
   * Update an SMS template
   */
  async updateSMSTemplate(
    templateId: string,
    templateData: Partial<SMSTemplate>,
    updatedBy: string,
  ): Promise<void> {
    try {
      await updateDoc(doc(db, SMS_TEMPLATES_COLLECTION, templateId), {
        ...templateData,
        updatedBy,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error updating SMS template:", error);
      throw error;
    }
  },

  /**
   * Delete an SMS template (soft delete by setting isActive to false)
   */
  async deleteSMSTemplate(
    templateId: string,
    updatedBy: string,
  ): Promise<void> {
    try {
      await updateDoc(doc(db, SMS_TEMPLATES_COLLECTION, templateId), {
        isActive: false,
        updatedBy,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error deleting SMS template:", error);
      throw error;
    }
  },

  /**
   * Get SMS settings for a clinic
   */
  async getSMSSettings(clinicId: string): Promise<SMSSettings | null> {
    try {
      const settingsDoc = await getDoc(
        doc(db, SMS_SETTINGS_COLLECTION, clinicId),
      );

      if (settingsDoc.exists()) {
        const data = settingsDoc.data();

        return {
          id: settingsDoc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as SMSSettings;
      }

      return null;
    } catch (error) {
      console.error("Error fetching SMS settings:", error);
      throw error;
    }
  },

  /**
   * Update SMS settings for a clinic
   */
  async updateSMSSettings(
    clinicId: string,
    settings: Partial<SMSSettings>,
    updatedBy: string,
  ): Promise<void> {
    try {
      await updateDoc(doc(db, SMS_SETTINGS_COLLECTION, clinicId), {
        ...settings,
        updatedBy,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error updating SMS settings:", error);
      throw error;
    }
  },

  /**
   * Create default SMS settings for a clinic
   */
  async createDefaultSMSSettings(
    clinicId: string,
    branchId?: string | null,
    createdBy: string = "system",
  ): Promise<void> {
    try {
      // Create base settings object with required fields
      const defaultSettings: Record<string, any> = {
        clinicId,
        apiKey: import.meta.env.VITE_SMS_API_KEY || "",
        senderId: import.meta.env.VITE_SMS_SENDER_ID || "",
        apiUrl: import.meta.env.VITE_SMS_API_URL || "",
        enableReminders: true,
        reminderHours: 24,
        maxDailySMS: 100,
        currentDailySMS: 0,
        lastResetDate: new Date().toISOString().split("T")[0],
        enableAutoReminders: true,
        smsBalance: 0,
        isActive: true,
        updatedBy: createdBy,
      };

      // Only add branchId if it has a value (not null/undefined)
      if (branchId) {
        defaultSettings.branchId = branchId;
      }

      // Use setDoc with clinicId as document ID instead of addDoc
      await setDoc(doc(db, SMS_SETTINGS_COLLECTION, clinicId), {
        ...defaultSettings,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error creating default SMS settings:", error);
      throw error;
    }
  },

  /**
   * Send manual SMS with comprehensive logging and atomic updates
   */
  async sendManualSMS(
    clinicId: string,
    phoneNumber: string,
    message: string,
    recipientType: "patient" | "doctor",
    recipientId: string,
    recipientName: string,
    createdBy: string,
    templateId?: string,
    branchId?: string,
  ): Promise<void> {
    try {
      // Get SMS settings for the clinic
      const smsSettings = await this.getSMSSettings(clinicId);

      if (!smsSettings) {
        throw new Error("SMS settings not configured for this clinic");
      }

      // Check daily SMS limit
      if (smsSettings.currentDailySMS >= smsSettings.maxDailySMS) {
        throw new Error("Daily SMS limit reached");
      }

      // Send the SMS
      const response = await this.sendMessage(
        phoneNumber,
        message,
        smsSettings,
      );
      const isSuccess = response.success || response.isRawText;

      // Prepare log data
      const logData: Omit<SMSLog, "id" | "createdAt" | "updatedAt"> = {
        clinicId,
        message,
        status: isSuccess ? "sent" : "failed",
        type: templateId ? "template" : "manual",
        recipientType,
        createdBy,
      };

      // Only add optional fields if they have values (avoid undefined)
      if (branchId) logData.branchId = branchId;
      if (templateId) logData.templateId = templateId;
      if (!isSuccess) logData.errorMessage = "SMS sending failed";

      if (recipientType === "patient") {
        logData.patientId = recipientId;
        logData.patientName = recipientName;
        logData.patientPhone = phoneNumber;
      } else {
        logData.doctorId = recipientId;
        logData.doctorName = recipientName;
        logData.doctorPhone = phoneNumber;
      }

      // Use transaction for atomic updates
      await runTransaction(db, async (transaction) => {
        // Create SMS log
        const logRef = doc(collection(db, SMS_LOGS_COLLECTION));

        transaction.set(logRef, {
          ...logData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        // Update clinic SMS count
        const clinicRef = doc(db, CLINICS_COLLECTION, clinicId);

        transaction.update(clinicRef, {
          smsCount: increment(1),
        });

        // Update daily SMS count
        const settingsRef = doc(db, SMS_SETTINGS_COLLECTION, clinicId);

        transaction.update(settingsRef, {
          currentDailySMS: increment(1),
        });

        // If using a template, increment usage count
        if (templateId) {
          const templateRef = doc(db, SMS_TEMPLATES_COLLECTION, templateId);

          transaction.update(templateRef, {
            usageCount: increment(1),
          });
        }
      });
    } catch (error) {
      console.error("Error sending manual SMS:", error);
      throw error;
    }
  },

  /**
   * Reset daily SMS count (should be called daily via scheduled function)
   */
  async resetDailySMSCount(clinicId: string): Promise<void> {
    try {
      const today = new Date().toISOString().split("T")[0];

      await updateDoc(doc(db, SMS_SETTINGS_COLLECTION, clinicId), {
        currentDailySMS: 0,
        lastResetDate: today,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error resetting daily SMS count:", error);
      throw error;
    }
  },

  /**
   * Get SMS statistics for a clinic with efficient parallel data fetching
   */
  async getSMSStatistics(
    clinicId: string,
    branchId?: string,
  ): Promise<{
    totalSent: number;
    totalFailed: number;
    todaySent: number;
    remainingToday: number;
    templatesCount: number;
    activeTemplatesCount: number;
  }> {
    try {
      const [smsSettings, logsSnapshot, templatesSnapshot] = await Promise.all([
        this.getSMSSettings(clinicId),
        getDocs(
          query(
            collection(db, SMS_LOGS_COLLECTION),
            where("clinicId", "==", clinicId),
            ...(branchId ? [where("branchId", "==", branchId)] : []),
          ),
        ),
        getDocs(
          query(
            collection(db, SMS_TEMPLATES_COLLECTION),
            where("clinicId", "==", clinicId),
            ...(branchId ? [where("branchId", "==", branchId)] : []),
          ),
        ),
      ]);

      const logs = logsSnapshot.docs.map((doc) => doc.data());
      const templates = templatesSnapshot.docs.map((doc) => doc.data());

      const today = new Date().toISOString().split("T")[0];
      const todayLogs = logs.filter((log) => {
        const logDate =
          log.createdAt?.toDate?.()?.toISOString().split("T")[0] ||
          new Date(log.createdAt).toISOString().split("T")[0];

        return logDate === today;
      });

      return {
        totalSent: logs.filter((log) => log.status === "sent").length,
        totalFailed: logs.filter((log) => log.status === "failed").length,
        todaySent: todayLogs.filter((log) => log.status === "sent").length,
        remainingToday: Math.max(
          0,
          (smsSettings?.maxDailySMS || 100) -
          (smsSettings?.currentDailySMS || 0),
        ),
        templatesCount: templates.length,
        activeTemplatesCount: templates.filter((template) => template.isActive)
          .length,
      };
    } catch (error) {
      console.error("Error getting SMS statistics:", error);
      throw error;
    }
  },

  /**
   * Batch send SMS messages with optimized performance
   */
  async batchSendSMS(
    messages: Array<{
      clinicId: string;
      phoneNumber: string;
      message: string;
      recipientType: "patient" | "doctor";
      recipientId: string;
      recipientName: string;
      templateId?: string;
      branchId?: string;
    }>,
    createdBy: string,
  ): Promise<{
    success: number;
    failed: number;
    results: Array<{ success: boolean; error?: string }>;
  }> {
    try {
      const results: Array<{ success: boolean; error?: string }> = [];
      let successCount = 0;
      let failedCount = 0;

      // Process messages in batches to avoid overwhelming the system
      const batchSize = 10;

      for (let i = 0; i < messages.length; i += batchSize) {
        const batch = messages.slice(i, i + batchSize);

        const batchPromises = batch.map(async (msg) => {
          try {
            await this.sendManualSMS(
              msg.clinicId,
              msg.phoneNumber,
              msg.message,
              msg.recipientType,
              msg.recipientId,
              msg.recipientName,
              createdBy,
              msg.templateId,
              msg.branchId,
            );
            successCount++;

            return { success: true };
          } catch (error) {
            failedCount++;

            return {
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            };
          }
        });

        const batchResults = await Promise.allSettled(batchPromises);

        results.push(
          ...batchResults.map((result) =>
            result.status === "fulfilled"
              ? result.value
              : { success: false, error: "Promise rejected" },
          ),
        );
      }

      return {
        success: successCount,
        failed: failedCount,
        results,
      };
    } catch (error) {
      console.error("Error in batch SMS sending:", error);
      throw error;
    }
  },

  /**
   * Check if appointment reminders are enabled for a specific appointment type
   *
   * This function handles several scenarios:
   * 1. If SMS settings don't exist, it attempts to create default ones
   * 2. If creation fails due to permissions, it gracefully fails without blocking appointments
   * 3. If reminders are disabled, it logs the reason and returns false
   * 4. If appointment type restrictions are configured, it checks them
   *
   * The function is designed to never throw errors that would block appointment creation
   */
  async checkAppointmentReminderEligibility(
    clinicId: string,
    appointmentTypeId: string,
  ): Promise<{ isEligible: boolean; reminderHours: number }> {
    try {
      let settings = await this.getSMSSettings(clinicId);

      // If no settings exist, try to create default ones
      if (!settings) {
        try {
          await this.createDefaultSMSSettings(clinicId, null, "system");
          settings = await this.getSMSSettings(clinicId);
        } catch (createError) {
          console.error("Error creating default SMS settings:", createError);

          // If we can't create settings due to permissions, that's okay
          // The appointment creation should still proceed without SMS reminders
          return { isEligible: false, reminderHours: 0 };
        }
      }

      if (!settings || !settings.enableReminders) {
        return { isEligible: false, reminderHours: 0 };
      }

      // Get the appointment type name
      // Note: Using 'appointment_types' (with underscore) to match the collection name used in appointmentTypeService
      const appointmentTypeDoc = await getDoc(
        doc(db, "appointment_types", appointmentTypeId),
      );

      if (!appointmentTypeDoc.exists()) {
        return { isEligible: false, reminderHours: 0 };
      }

      const appointmentTypeData = appointmentTypeDoc.data();
      const appointmentTypeName = appointmentTypeData.name;

      // Check if reminders are restricted to a specific appointment type
      // Normalize strings for comparison (trim whitespace and normalize case)
      const storedTypeName = settings.smsAppointmentType?.trim() || "";
      const actualTypeName = appointmentTypeName?.trim() || "";

      // Use normalized comparison instead of exact match
      if (
        storedTypeName &&
        storedTypeName !== "" &&
        storedTypeName !== actualTypeName
      ) {
        return { isEligible: false, reminderHours: 0 };
      }

      return {
        isEligible: true,
        reminderHours: settings.reminderHours || 24,
      };
    } catch (error) {
      console.error("Error checking appointment reminder eligibility:", error);

      // Return false eligibility on any error to prevent blocking appointment creation
      return { isEligible: false, reminderHours: 0 };
    }
  },

  /**
   * Schedule an appointment reminder using Appwrite SMS scheduler
   * Implements smart scheduling logic based on appointment time
   */
  async scheduleAppointmentReminder(appointment: {
    id: string;
    appointmentDate: Date;
    patientId: string;
    doctorId: string;
    clinicId: string;
    branchId?: string;
    appointmentTypeId: string;
    startTime?: string;
  }): Promise<boolean> {
    try {
      // Skip if no start time is provided
      if (!appointment.startTime) {
        return false;
      }

      // Check if reminders are enabled for this appointment type
      const { isEligible, reminderHours } =
        await this.checkAppointmentReminderEligibility(
          appointment.clinicId,
          appointment.appointmentTypeId,
        );

      if (!isEligible) {
        return false;
      }

      // Calculate appointment datetime by combining date and start time
      const appointmentDate = new Date(appointment.appointmentDate);
      const [hours, minutes] = appointment.startTime.split(":");

      appointmentDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

      // Calculate time until appointment
      const now = new Date();
      const hoursUntilAppointment =
        (appointmentDate.getTime() - now.getTime()) / (1000 * 60 * 60);

      // Smart scheduling logic
      let reminderHoursBeforeAppointment: number;

      if (hoursUntilAppointment >= 24) {
        // 24+ hours away: Use the configured reminder hours (typically 24h)
        reminderHoursBeforeAppointment = reminderHours;
      } else if (hoursUntilAppointment >= 4) {
        // 4-24 hours away: Automatically adjust to 2 hours before
        reminderHoursBeforeAppointment = 2;
      } else if (hoursUntilAppointment >= 2) {
        // 2-4 hours away: Schedule 1 hour before
        reminderHoursBeforeAppointment = 1;
      } else {
        // Less than 2 hours: Skip reminder (too close)
        return false;
      }

      // Calculate when the reminder should be sent
      const reminderDate = new Date(appointmentDate);

      reminderDate.setHours(
        appointmentDate.getHours() - reminderHoursBeforeAppointment,
      );

      // If reminder time is in the past, don't schedule
      if (reminderDate <= now) {
        return false;
      }

      // Generate appointment reminder message
      const reminderMessage = await this.generateAppointmentReminderMessage(
        appointment.patientId,
        appointment.doctorId,
        appointment.clinicId,
        appointmentDate,
        reminderHoursBeforeAppointment,
      );

      if (!reminderMessage) {
        console.error("Failed to generate reminder message");

        return false;
      }

      // Schedule the SMS using Appwrite SMS scheduler
      const scheduled = await this.scheduleAppointmentSMS(
        appointment.patientId,
        reminderMessage,
        reminderDate.toISOString(),
      );

      if (scheduled) {
        // Get patient information for logging
        let patientName = "Unknown Patient";
        let patientPhone = "";

        try {
          const patientDoc = await getDoc(
            doc(db, PATIENTS_COLLECTION, appointment.patientId),
          );

          if (patientDoc.exists()) {
            const patient = patientDoc.data();

            patientName = patient.name || "Unknown Patient";
            patientPhone = patient.mobile || patient.phone || "";
          }
        } catch (error) {
          console.error("Error fetching patient for log:", error);
        }

        // Create SMS log for scheduled reminder
        try {
          await this.createSMSLog({
            clinicId: appointment.clinicId,
            ...(appointment.branchId && { branchId: appointment.branchId }),
            patientId: appointment.patientId,
            patientName: patientName,
            patientPhone: patientPhone,
            message: reminderMessage,
            status: "pending",
            type: "reminder",
            recipientType: "patient",
            createdBy: "system",
          });
        } catch (logError) {
          console.error(
            "Error creating SMS log for patient reminder:",
            logError,
          );
          // Don't fail the reminder scheduling if logging fails
        }

        // Store the reminder metadata in Firestore
        await addDoc(collection(db, "appointmentReminders"), {
          appointmentId: appointment.id,
          patientId: appointment.patientId,
          doctorId: appointment.doctorId,
          clinicId: appointment.clinicId,
          branchId: appointment.branchId || "", // Include branchId
          appointmentDate: Timestamp.fromDate(appointmentDate),
          reminderDate: Timestamp.fromDate(reminderDate),
          reminderHours: reminderHoursBeforeAppointment,
          originalReminderHours: reminderHours,
          smartSchedulingApplied:
            reminderHoursBeforeAppointment !== reminderHours,
          hoursUntilAppointment: hoursUntilAppointment,
          status: "scheduled",
          createdAt: serverTimestamp(),
          createdBy: "system", // Mark as system-created for automated reminders
        });

        return true;
      }

      return false;
    } catch (error) {
      console.error("Error scheduling appointment reminder:", error);
      // Log specific error details for debugging
      if (error instanceof Error) {
        console.error("Error details:", {
          message: error.message,
          stack: error.stack,
          appointmentId: appointment.id,
          clinicId: appointment.clinicId,
        });
      }

      return false;
    }
  },

  /**
   * Generate a personalized appointment reminder message
   */
  async generateAppointmentReminderMessage(
    patientId: string,
    doctorId: string,
    clinicId: string,
    appointmentDate: Date,
    reminderHours: number,
  ): Promise<string | null> {
    try {
      // Get patient, doctor, and clinic information
      const [patientDoc, doctorDoc, clinicDoc] = await Promise.all([
        getDoc(doc(db, PATIENTS_COLLECTION, patientId)),
        getDoc(doc(db, DOCTORS_COLLECTION, doctorId)),
        getDoc(doc(db, CLINICS_COLLECTION, clinicId)),
      ]);

      if (!patientDoc.exists() || !doctorDoc.exists() || !clinicDoc.exists()) {
        console.error("Missing patient, doctor, or clinic data for reminder");

        return null;
      }

      const patient = patientDoc.data();
      const doctor = doctorDoc.data();
      const clinic = clinicDoc.data();

      // Format appointment date and time
      const appointmentDateStr = appointmentDate.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      const appointmentTimeStr = appointmentDate.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });

      // Generate personalized message
      const reminderText =
        reminderHours === 1 ? "1 hour" : `${reminderHours} hours`;

      const message = `Dear ${patient.name}, this is a reminder that you have an appointment with ${doctor.name} at ${clinic.name} on ${appointmentDateStr} at ${appointmentTimeStr}. Please arrive 15 minutes early. Contact us if you need to reschedule.`;

      return message;
    } catch (error) {
      console.error("Error generating appointment reminder message:", error);

      return null;
    }
  },

  /**
   * Schedule an SMS using the Appwrite SMS scheduler
   */
  async scheduleAppointmentSMS(
    patientId: string,
    message: string,
    scheduledTime: string,
  ): Promise<boolean> {
    try {
      // Get patient phone number
      const patientDoc = await getDoc(doc(db, PATIENTS_COLLECTION, patientId));

      if (!patientDoc.exists()) {
        console.error("Patient not found for SMS scheduling");

        return false;
      }

      const patient = patientDoc.data();

      // Check mobile first (main field), then phone (secondary field)
      const phoneNumber = patient.mobile || patient.phone;

      if (!phoneNumber) {
        console.error("Patient phone number not found:", {
          id: patientId,
          name: patient.name,
          mobile: patient.mobile,
          phone: patient.phone,
        });

        return false;
      }

      // Import Appwrite client here to avoid circular dependencies
      const { Client, Functions } = await import("appwrite");

      const client = new Client()
        .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT)
        .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID);

      const functions = new Functions(client);

      // Schedule the SMS using the sms-tester function
      const response = await functions.createExecution(
        "sms-tester",
        JSON.stringify({
          action: "schedule_test",
          phoneNumber: phoneNumber,
          message: message,
          scheduledTime: scheduledTime,
        }),
        false,
        "POST",
      );

      if (response.status === "completed") {
        const result = JSON.parse(response.responseBody);

        return result.success;
      }

      return false;
    } catch (error) {
      console.error("Error scheduling SMS via Appwrite:", error);

      return false;
    }
  },

  /**
   * Generate a personalized appointment reminder message for doctors
   */
  async generateDoctorAppointmentReminderMessage(
    patientId: string,
    doctorId: string,
    clinicId: string,
    appointmentDate: Date,
    reminderHours: number,
  ): Promise<string | null> {
    try {
      // Get patient, doctor, and clinic information
      const [patientDoc, doctorDoc, clinicDoc] = await Promise.all([
        getDoc(doc(db, PATIENTS_COLLECTION, patientId)),
        getDoc(doc(db, DOCTORS_COLLECTION, doctorId)),
        getDoc(doc(db, CLINICS_COLLECTION, clinicId)),
      ]);

      if (!patientDoc.exists() || !doctorDoc.exists() || !clinicDoc.exists()) {
        console.error(
          "Missing patient, doctor, or clinic data for doctor reminder",
        );

        return null;
      }

      const patient = patientDoc.data();
      const doctor = doctorDoc.data();
      const clinic = clinicDoc.data();

      // Format appointment date and time
      const appointmentDateStr = appointmentDate.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      const appointmentTimeStr = appointmentDate.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });

      // Generate personalized message for doctor
      const reminderText =
        reminderHours === 1 ? "1 hour" : `${reminderHours} hours`;

      const message = `${doctor.name}, you have an appointment with ${patient.name} (Reg# ${patient.regNumber}) at ${clinic.name} on ${appointmentDateStr} at ${appointmentTimeStr}. Patient contact: ${patient.mobile || patient.phone || "N/A"}.`;

      return message;
    } catch (error) {
      console.error(
        "Error generating doctor appointment reminder message:",
        error,
      );

      return null;
    }
  },

  /**
   * Schedule an SMS for doctors using the Appwrite SMS scheduler
   */
  async scheduleDoctorAppointmentSMS(
    doctorId: string,
    message: string,
    scheduledTime: string,
  ): Promise<boolean> {
    try {
      // Get doctor phone number
      const doctorDoc = await getDoc(doc(db, DOCTORS_COLLECTION, doctorId));

      if (!doctorDoc.exists()) {
        console.error("Doctor not found for SMS scheduling");

        return false;
      }

      const doctor = doctorDoc.data();

      // Check doctor phone number
      const phoneNumber = doctor.phone;

      if (!phoneNumber) {
        console.error("Doctor phone number not found:", {
          id: doctorId,
          name: doctor.name,
          phone: doctor.phone,
        });

        return false;
      }

      // Import Appwrite client here to avoid circular dependencies
      const { Client, Functions } = await import("appwrite");

      const client = new Client()
        .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT)
        .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID);

      const functions = new Functions(client);

      // Schedule the SMS using the sms-tester function
      const response = await functions.createExecution(
        "sms-tester",
        JSON.stringify({
          action: "schedule_test",
          phoneNumber: phoneNumber,
          message: message,
          scheduledTime: scheduledTime,
        }),
        false,
        "POST",
      );

      if (response.status === "completed") {
        const result = JSON.parse(response.responseBody);

        return result.success;
      }

      return false;
    } catch (error) {
      console.error("Error scheduling doctor SMS via Appwrite:", error);

      return false;
    }
  },

  /**
   * Schedule a doctor appointment reminder using Appwrite SMS scheduler
   * Implements smart scheduling logic based on appointment time
   */
  async scheduleDoctorAppointmentReminder(appointment: {
    id: string;
    appointmentDate: Date;
    patientId: string;
    doctorId: string;
    clinicId: string;
    branchId?: string;
    appointmentTypeId: string;
    startTime?: string;
  }): Promise<boolean> {
    try {
      // Skip if no start time is provided
      if (!appointment.startTime) {
        return false;
      }

      // Check if reminders are enabled for this appointment type
      const { isEligible, reminderHours } =
        await this.checkAppointmentReminderEligibility(
          appointment.clinicId,
          appointment.appointmentTypeId,
        );

      if (!isEligible) {
        return false;
      }

      // Calculate appointment datetime by combining date and start time
      const appointmentDate = new Date(appointment.appointmentDate);
      const [hours, minutes] = appointment.startTime.split(":");

      appointmentDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

      // Calculate time until appointment
      const now = new Date();
      const hoursUntilAppointment =
        (appointmentDate.getTime() - now.getTime()) / (1000 * 60 * 60);

      // Smart scheduling logic (same as patient reminder)
      let reminderHoursBeforeAppointment: number;

      if (hoursUntilAppointment >= 24) {
        // 24+ hours away: Use the configured reminder hours (typically 24h)
        reminderHoursBeforeAppointment = reminderHours;
      } else if (hoursUntilAppointment >= 4) {
        // 4-24 hours away: Automatically adjust to 2 hours before
        reminderHoursBeforeAppointment = 2;
      } else if (hoursUntilAppointment >= 2) {
        // 2-4 hours away: Schedule 1 hour before
        reminderHoursBeforeAppointment = 1;
      } else {
        // Less than 2 hours: Skip reminder (too close)
        return false;
      }

      // Calculate when the reminder should be sent
      const reminderDate = new Date(appointmentDate);

      reminderDate.setHours(
        appointmentDate.getHours() - reminderHoursBeforeAppointment,
      );

      // If reminder time is in the past, don't schedule
      if (reminderDate <= now) {
        return false;
      }

      // Generate doctor appointment reminder message
      const reminderMessage =
        await this.generateDoctorAppointmentReminderMessage(
          appointment.patientId,
          appointment.doctorId,
          appointment.clinicId,
          appointmentDate,
          reminderHoursBeforeAppointment,
        );

      if (!reminderMessage) {
        console.error("Failed to generate doctor reminder message");

        return false;
      }

      // Schedule the SMS using Appwrite SMS scheduler
      const scheduled = await this.scheduleDoctorAppointmentSMS(
        appointment.doctorId,
        reminderMessage,
        reminderDate.toISOString(),
      );

      if (scheduled) {
        // Get doctor information for logging
        let doctorName = "Unknown Doctor";
        let doctorPhone = "";

        try {
          const doctorDoc = await getDoc(
            doc(db, DOCTORS_COLLECTION, appointment.doctorId),
          );

          if (doctorDoc.exists()) {
            const doctor = doctorDoc.data();

            doctorName = doctor.name || "Unknown Doctor";
            doctorPhone = doctor.phone || "";
          }
        } catch (error) {
          console.error("Error fetching doctor for log:", error);
        }

        // Create SMS log for scheduled doctor reminder
        try {
          await this.createSMSLog({
            clinicId: appointment.clinicId,
            ...(appointment.branchId && { branchId: appointment.branchId }),
            doctorId: appointment.doctorId,
            doctorName: doctorName,
            doctorPhone: doctorPhone,
            message: reminderMessage,
            status: "pending",
            type: "reminder",
            recipientType: "doctor",
            createdBy: "system",
          });
        } catch (logError) {
          console.error(
            "Error creating SMS log for doctor reminder:",
            logError,
          );
          // Don't fail the reminder scheduling if logging fails
        }

        // Store the doctor reminder metadata in Firestore
        await addDoc(collection(db, "doctorAppointmentReminders"), {
          appointmentId: appointment.id,
          patientId: appointment.patientId,
          doctorId: appointment.doctorId,
          clinicId: appointment.clinicId,
          branchId: appointment.branchId || "", // Include branchId
          appointmentDate: Timestamp.fromDate(appointmentDate),
          reminderDate: Timestamp.fromDate(reminderDate),
          reminderHours: reminderHoursBeforeAppointment,
          originalReminderHours: reminderHours,
          smartSchedulingApplied:
            reminderHoursBeforeAppointment !== reminderHours,
          hoursUntilAppointment: hoursUntilAppointment,
          status: "scheduled",
          createdAt: serverTimestamp(),
          createdBy: "system", // Mark as system-created for automated reminders
        });

        return true;
      }

      return false;
    } catch (error) {
      console.error("Error scheduling doctor appointment reminder:", error);
      // Log specific error details for debugging
      if (error instanceof Error) {
        console.error("Doctor reminder error details:", {
          message: error.message,
          stack: error.stack,
          appointmentId: appointment.id,
          doctorId: appointment.doctorId,
          clinicId: appointment.clinicId,
        });
      }

      return false;
    }
  },

  /**
   * Send a "Thank You" / Welcome SMS to a newly created patient
   */
  async sendWelcomeSMS(patient: {
    id: string;
    name: string;
    mobile?: string;
    phone?: string;
    clinicId: string;
    branchId?: string;
  }): Promise<boolean> {
    try {
      const clinicDoc = await getDoc(doc(db, CLINICS_COLLECTION, patient.clinicId));
      if (!clinicDoc.exists()) return false;
      const clinic = clinicDoc.data();

      // Check if welcome SMS is enabled in settings
      const settings = await this.getSMSSettings(patient.clinicId);
      if (!settings || !settings.isActive) return false;

      const message = `Dear ${patient.name}, thank you for choosing ${clinic.name}. We are honored to serve your healthcare needs. For appointments, call ${clinic.phone || ""}.`;

      // Try to use a template if available
      let finalMessage = message;
      try {
        const templates = await this.getSMSTemplates(patient.clinicId);
        const welcomeTemplate = templates.find(t => t.name.includes("Welcome Message") && t.language === "en");

        if (welcomeTemplate) {
          finalMessage = welcomeTemplate.message
            .replace(/{patientName}/g, patient.name)
            .replace(/{clinicName}/g, clinic.name || "our clinic")
            .replace(/{clinicPhone}/g, clinic.phone || "");
        }
      } catch (err) {
        console.warn("Could not fetch welcome template, using default:", err);
      }

      const phoneNumber = patient.mobile || patient.phone;
      if (!phoneNumber) return false;

      // Send the SMS with settings
      const response = await this.sendMessage(phoneNumber, finalMessage, settings);
      const isSuccess = response.success || response.isRawText;

      // Log the SMS (Success or Failure)
      await this.createSMSLog({
        clinicId: patient.clinicId,
        branchId: patient.branchId,
        patientId: patient.id,
        patientName: patient.name,
        patientPhone: phoneNumber,
        message: finalMessage,
        status: isSuccess ? "sent" : "failed",
        type: "general",
        recipientType: "patient",
        createdBy: "system",
      });

      return isSuccess;
    } catch (error) {
      console.error("Error sending welcome SMS:", error);
      return false;
    }
  },

  /**
   * Seed default SMS templates for a clinic
   */
  async seedTemplates(clinicId: string, userId: string): Promise<{ count: number; skipped: number }> {
    const defaultTemplates = [
      // English Templates
      { name: "Appointment Reminder (EN)", type: "patient", language: "en", message: "Dear {patientName}, your appointment with Dr. {doctorName} is on {date} at {time}. Please arrive 15 minutes early." },
      { name: "Welcome Message (EN)", type: "general", language: "en", message: "Welcome to {clinicName}! We are honored to serve your healthcare needs. Call us at {clinicPhone} for any queries." },
      { name: "Lab Report Ready (EN)", type: "patient", language: "en", message: "Dear {patientName}, your lab report is ready. Please visit our clinic or call {clinicPhone} to discuss with your doctor." },

      // Nepali Templates
      { name: "अपोइन्टमेन्ट रिमाइन्डर (NE)", type: "patient", language: "ne", message: "नमस्ते {patientName}, डा. {doctorName} सँगको तपाईंको अपोइन्टमेन्ट {date} मा {time} बजे छ। कृपया समयमै आउनुहोला।" },
      { name: "स्वागत सन्देश (NE)", type: "general", language: "ne", message: "हाम्रो क्लिनिकमा स्वागत छ! तपाईंको स्वास्थ्य सेवा गर्न पाउँदा हामी खुसी छौं। जिज्ञासाको लागि {clinicPhone} मा सम्पर्क गर्नुहोस्।" },
      { name: "रिपोर्ट तयार छ (NE)", type: "patient", language: "ne", message: "नमस्ते {patientName}, तपाईंको ल्याब रिपोर्ट तयार भएको छ। कृपया क्लिनिकमा आएर बुझ्नुहोला।" }
    ];

    let count = 0;
    let skipped = 0;

    try {
      // Get existing templates to avoid duplicates
      const existingTemplates = await this.getSMSTemplates(clinicId);
      const existingNames = new Set(existingTemplates.map(t => t.name.toLowerCase()));

      for (const t of defaultTemplates) {
        if (existingNames.has(t.name.toLowerCase())) {
          skipped++;
          continue;
        }

        await this.createSMSTemplate({
          clinicId,
          name: t.name,
          type: t.type as any,
          language: t.language as any,
          message: t.message,
          createdBy: userId,
          updatedBy: userId,
          isActive: true,
          usageCount: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        count++;
      }

      return { count, skipped };
    } catch (error) {
      console.error("Error seeding templates:", error);
      throw error;
    }
  },
};

// Export individual functions for backward compatibility
export const sendMessage = smsService.sendMessage.bind(smsService);
export const sendAppointmentReminders =
  smsService.sendAppointmentReminders.bind(smsService);
export const getSMSLogs = smsService.getSMSLogs.bind(smsService);
export const addSMSLog = smsService.createSMSLog.bind(smsService);
export const getSMSTemplates = smsService.getSMSTemplates.bind(smsService);
export const addSMSTemplate = smsService.createSMSTemplate.bind(smsService);
export const updateSMSTemplate = smsService.updateSMSTemplate.bind(smsService);
export const deleteSMSTemplate = smsService.deleteSMSTemplate.bind(smsService);
export const getSMSSettings = smsService.getSMSSettings.bind(smsService);
export const updateSMSSettings = smsService.updateSMSSettings.bind(smsService);
export const createDefaultSMSSettings =
  smsService.createDefaultSMSSettings.bind(smsService);
export const sendManualSMS = smsService.sendManualSMS.bind(smsService);
export const batchSendSMS = smsService.batchSendSMS.bind(smsService);
export const getSMSStatistics = smsService.getSMSStatistics.bind(smsService);
export const resetDailySMSCount =
  smsService.resetDailySMSCount.bind(smsService);
export const checkAppointmentReminderEligibility =
  smsService.checkAppointmentReminderEligibility.bind(smsService);
export const scheduleAppointmentReminder =
  smsService.scheduleAppointmentReminder.bind(smsService);
export const scheduleDoctorAppointmentReminder =
  smsService.scheduleDoctorAppointmentReminder.bind(smsService);
export const seedSMSTemplates = smsService.seedTemplates.bind(smsService);
export const sendWelcomeSMS = smsService.sendWelcomeSMS.bind(smsService);

// Default export
export default smsService;
