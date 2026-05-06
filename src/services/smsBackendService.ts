// SMS Backend Service - New Node.js Express Backend Integration
import axios, { AxiosResponse } from "axios";

// Configuration
const SMS_BACKEND_URL =
  import.meta.env.VITE_SMS_BACKEND_URL || "https://your-backend-server.com";
const API_KEY = import.meta.env.VITE_SMS_BACKEND_API_KEY || "your-api-key";

// Types
export interface SMSBackendResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  details?: any;
}

export interface AppointmentData {
  appointmentId: string;
  patientPhone: string;
  doctorName: string;
  appointmentTime: string;
  clinicName: string;
  appointmentType?: string;
  clinicId: string;
}

export interface ClinicSettings {
  enabled: boolean;
  advanceNoticeHours: number;
  enabledAppointmentTypes: string[];
  businessHoursOnly: boolean;
  businessStartHour: number;
  businessEndHour: number;
}

export interface AppointmentType {
  appointmentType: string;
  count: number;
  latestUsed: string;
  sentCount: number;
  failedCount: number;
  isEnabled: boolean;
}

export interface CronStatus {
  timestamp: string;
  cronJobs: {
    status: string;
    schedules: Record<string, string>;
  };
  statistics: {
    pendingReminders: number;
    upcomingReminders: number;
    todaysSms: {
      sent: number;
      failed: number;
    };
  };
  recentLogs: Array<{
    type: string;
    timestamp: string;
    status: string;
    metrics?: any;
    stats?: any;
  }>;
}

export interface SMSLog {
  phoneNumber: string;
  message: string;
  appointmentId?: string;
  clinicId?: string;
  type: "instant" | "reminder";
  status: "sent" | "failed";
  sentAt?: string;
  attemptedAt?: string;
  response?: any;
  error?: string;
}

class SMSBackendService {
  private baseURL: string;
  private apiKey: string;

  constructor() {
    this.baseURL = SMS_BACKEND_URL;
    this.apiKey = API_KEY;
  }

  private async makeRequest<T>(
    endpoint: string,
    method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
    data?: any,
  ): Promise<SMSBackendResponse<T>> {
    try {
      const config = {
        method,
        url: `${this.baseURL}${endpoint}`,
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": this.apiKey,
        },
        ...(data && { data }),
      };

      const response: AxiosResponse<SMSBackendResponse<T>> =
        await axios(config);

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response) {
          return {
            success: false,
            error: error.response.data?.error || error.response.statusText,
            details: error.response.data,
          };
        } else {
          return {
            success: false,
            error: `Network error: ${error.message}`,
          };
        }
      } else {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }
  }

  // Health Check
  async healthCheck(): Promise<SMSBackendResponse> {
    return this.makeRequest("/health");
  }

  // Send Instant SMS
  async sendInstantSMS(
    phoneNumber: string,
    message: string,
    appointmentId?: string,
  ): Promise<SMSBackendResponse> {
    return this.makeRequest("/send-sms", "POST", {
      phoneNumber,
      message,
      appointmentId,
    });
  }

  // Schedule Appointment Reminder
  async scheduleReminder(
    appointmentData: AppointmentData,
  ): Promise<SMSBackendResponse> {
    return this.makeRequest("/schedule-reminder", "POST", appointmentData);
  }

  // Cancel Scheduled Reminder
  async cancelReminder(appointmentId: string): Promise<SMSBackendResponse> {
    return this.makeRequest(`/cancel-reminder/${appointmentId}`, "DELETE");
  }

  // Get SMS Logs
  async getSMSLogs(
    appointmentId?: string,
    limit: number = 50,
  ): Promise<SMSBackendResponse<SMSLog[]>> {
    const params = new URLSearchParams();

    if (appointmentId) params.append("appointmentId", appointmentId);
    if (limit) params.append("limit", limit.toString());

    const endpoint = `/sms-logs${params.toString() ? `?${params.toString()}` : ""}`;

    return this.makeRequest(endpoint);
  }

  // Get Clinic Settings
  async getClinicSettings(
    clinicId: string,
  ): Promise<SMSBackendResponse<ClinicSettings>> {
    return this.makeRequest(`/clinic-settings/${clinicId}`);
  }

  // Update Clinic Settings
  async updateClinicSettings(
    clinicId: string,
    smsSettings: ClinicSettings,
  ): Promise<SMSBackendResponse<ClinicSettings>> {
    return this.makeRequest(`/clinic-settings/${clinicId}`, "PUT", {
      smsSettings,
    });
  }

  // Get Appointment Types
  async getAppointmentTypes(
    clinicId: string,
    limit: number = 50,
  ): Promise<
    SMSBackendResponse<{
      clinicId: string;
      enabledAppointmentTypes: string[];
      smsEnabled: boolean;
      appointmentTypes: AppointmentType[];
    }>
  > {
    return this.makeRequest(`/appointment-types/${clinicId}?limit=${limit}`);
  }

  // Bulk Update Appointment Types
  async bulkUpdateAppointmentTypes(
    clinicId: string,
    enabledAppointmentTypes: string[],
    action: "add" | "remove" | "replace",
  ): Promise<SMSBackendResponse> {
    return this.makeRequest(
      `/bulk-update-appointment-types/${clinicId}`,
      "POST",
      {
        enabledAppointmentTypes,
        action,
      },
    );
  }

  // Test Smart Scheduling Logic
  async testScheduling(
    appointmentTime: string,
    clinicId?: string,
  ): Promise<SMSBackendResponse> {
    return this.makeRequest("/test-scheduling", "POST", {
      appointmentTime,
      clinicId,
    });
  }

  // Manual Cron Job Triggers
  async triggerCronJob(
    jobType:
      | "process-reminders"
      | "discover-appointments"
      | "daily-cleanup"
      | "health-check",
  ): Promise<SMSBackendResponse> {
    return this.makeRequest(`/trigger-cron/${jobType}`, "POST");
  }

  // Get Cron Status
  async getCronStatus(): Promise<SMSBackendResponse<CronStatus>> {
    return this.makeRequest("/cron-status");
  }

  // Utility Functions
  formatPhoneNumber(phoneNumber: string): string {
    const cleaned = phoneNumber.replace(/\D/g, "");

    if (cleaned.length === 10) {
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    if (cleaned.length === 11 && cleaned.startsWith("1")) {
      return `+1 ${cleaned.slice(1, 4)}-${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }

    return phoneNumber;
  }

  validatePhoneNumber(phoneNumber: string): {
    isValid: boolean;
    message?: string;
  } {
    const cleaned = phoneNumber.replace(/\D/g, "");

    if (cleaned.length < 10) {
      return {
        isValid: false,
        message: "Phone number must be at least 10 digits",
      };
    }

    if (cleaned.length > 15) {
      return {
        isValid: false,
        message: "Phone number cannot exceed 15 digits",
      };
    }

    return { isValid: true };
  }

  validateAppointmentData(data: Partial<AppointmentData>): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!data.appointmentId) errors.push("Appointment ID is required");
    if (!data.patientPhone) errors.push("Patient phone is required");
    if (!data.appointmentTime) errors.push("Appointment time is required");
    if (!data.clinicId) errors.push("Clinic ID is required");

    if (
      data.patientPhone &&
      !this.validatePhoneNumber(data.patientPhone).isValid
    ) {
      errors.push("Invalid phone number format");
    }

    if (data.appointmentTime) {
      const appointmentDate = new Date(data.appointmentTime);

      if (appointmentDate <= new Date()) {
        errors.push("Appointment time must be in the future");
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // Generate sample appointment data for testing
  generateSampleAppointment(
    overrides: Partial<AppointmentData> = {},
  ): AppointmentData {
    const now = new Date();
    const futureDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now

    return {
      appointmentId: `apt_${Date.now()}`,
      patientPhone: "+1234567890",
      doctorName: "Dr. Smith",
      appointmentTime: futureDate.toISOString(),
      clinicName: "Test Clinic",
      appointmentType: "consultation",
      clinicId: "test_clinic",
      ...overrides,
    };
  }
}

// Create singleton instance
export const smsBackendService = new SMSBackendService();

// Export convenience functions
export const sendInstantSMS =
  smsBackendService.sendInstantSMS.bind(smsBackendService);
export const scheduleReminder =
  smsBackendService.scheduleReminder.bind(smsBackendService);
export const cancelReminder =
  smsBackendService.cancelReminder.bind(smsBackendService);
export const getSMSLogs = smsBackendService.getSMSLogs.bind(smsBackendService);
export const getClinicSettings =
  smsBackendService.getClinicSettings.bind(smsBackendService);
export const updateClinicSettings =
  smsBackendService.updateClinicSettings.bind(smsBackendService);
export const getAppointmentTypes =
  smsBackendService.getAppointmentTypes.bind(smsBackendService);
export const testScheduling =
  smsBackendService.testScheduling.bind(smsBackendService);
export const triggerCronJob =
  smsBackendService.triggerCronJob.bind(smsBackendService);
export const getCronStatus =
  smsBackendService.getCronStatus.bind(smsBackendService);

export default smsBackendService;
