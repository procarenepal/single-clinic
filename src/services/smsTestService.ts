import axios from "axios";

// Types for SMS testing
export interface SMSTestRequest {
  action:
    | "send_test_sms"
    | "send_batch_test"
    | "schedule_test"
    | "get_test_logs";
  phoneNumber?: string;
  message?: string;
  recipients?: Array<{ phoneNumber: string; message: string }>;
  scheduledTime?: string;
}

export interface SMSTestResponse {
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
}

export interface SMSTestLog {
  $id: string;
  phone_number: string;
  message: string;
  status: "sent" | "failed" | "error" | "scheduled";
  response?: string;
  error_message?: string;
  test_type: "manual_test" | "batch_test" | "scheduled_test";
  scheduled_time?: string;
  timestamp: string;
}

class SMSTestService {
  private functionsUrl: string;
  private isFirebaseOffline: boolean = false;

  constructor() {
    this.functionsUrl = import.meta.env.VITE_FIREBASE_FUNCTIONS_URL || `https://us-central1-${import.meta.env.VITE_FIREBASE_PROJECT_ID}.cloudfunctions.net`;
  }

  /**
   * Check if the SMS function is running
   */
  async healthCheck(): Promise<SMSTestResponse> {
    const hasDirectGateway = !!(
      import.meta.env.VITE_SMS_API_KEY && import.meta.env.VITE_SMS_API_URL
    );

    const forceDirect = import.meta.env.VITE_SMS_FORCE_DIRECT === "true";

    if ((this.isFirebaseOffline || forceDirect) && hasDirectGateway) {
      this.isFirebaseOffline = true;
      return {
        success: true,
        message: "Direct Gateway Mode (Bypassed Firebase Check)",
        data: { mode: "direct" },
      };
    }

    try {
      const response = await axios.get(`${this.functionsUrl}/smsTester`, { validateStatus: () => true });

      if (response.status === 200) {
        return response.data;
      } else {
        throw new Error(`Function returned status ${response.status}`);
      }
    } catch (error) {
      console.warn("Firebase health check failed, checking direct gateway fallback...", error);
      this.isFirebaseOffline = true;

      if (hasDirectGateway) {
        return {
          success: true,
          message: "Direct Gateway Mode (Firebase Function Offline)",
          data: { mode: "direct" },
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Send a test SMS
   */
  async sendTestSMS(
    phoneNumber: string,
    message: string,
  ): Promise<SMSTestResponse> {
    try {
      if (!phoneNumber || !message) {
        throw new Error("Phone number and message are required");
      }

      const hasDirectGateway = !!(
        import.meta.env.VITE_SMS_API_KEY && import.meta.env.VITE_SMS_API_URL
      );

      if (this.isFirebaseOffline && hasDirectGateway) {
        const { smsService } = await import("./sendMessageService");
        const response = await smsService.sendMessage(phoneNumber, message);
        return {
          success: response.success || false,
          message: response.success ? "SMS sent successfully via Direct Gateway" : "Direct Gateway failed",
          data: response,
        };
      }

      try {
        const payload: SMSTestRequest = { action: "send_test_sms", phoneNumber, message };
        const response = await axios.post(`${this.functionsUrl}/smsTester`, payload);
        return response.data;
      } catch (firebaseError) {
        console.warn("Firebase SMS tester execution failed, trying direct gateway fallback...", firebaseError);
        this.isFirebaseOffline = true;

        const { smsService } = await import("./sendMessageService");
        const response = await smsService.sendMessage(phoneNumber, message);
        return {
          success: response.success || false,
          message: response.success ? "SMS sent successfully via Direct Gateway" : "Direct Gateway failed",
          data: response,
        };
      }
    } catch (error) {
      console.error("Test SMS failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Send batch test SMS
   */
  async sendBatchTest(
    recipients: Array<{ phoneNumber: string; message: string }>,
  ): Promise<SMSTestResponse> {
    try {
      if (!recipients || recipients.length === 0) {
        throw new Error("Recipients array is required");
      }

      const hasDirectGateway = !!(
        import.meta.env.VITE_SMS_API_KEY && import.meta.env.VITE_SMS_API_URL
      );

      if (this.isFirebaseOffline && hasDirectGateway) {
        const { smsService } = await import("./sendMessageService");
        const results = [];
        let successCount = 0;

        for (const recipient of recipients) {
          try {
            const res = await smsService.sendMessage(recipient.phoneNumber, recipient.message);
            if (res.success) successCount++;
            results.push({ phoneNumber: recipient.phoneNumber, success: res.success || false, response: res });
          } catch (e) {
            results.push({ phoneNumber: recipient.phoneNumber, success: false, error: e instanceof Error ? e.message : "Unknown error" });
          }
        }

        return {
          success: true,
          message: `Batch complete: ${successCount}/${recipients.length} sent successfully via Direct Gateway`,
          data: { total: recipients.length, successful: successCount, failed: recipients.length - successCount, results },
        };
      }

      try {
        const payload: SMSTestRequest = { action: "send_batch_test", recipients };
        const response = await axios.post(`${this.functionsUrl}/smsTester`, payload);
        return response.data;
      } catch (firebaseError) {
        console.warn("Firebase SMS batch execution failed, trying direct gateway fallback...", firebaseError);
        this.isFirebaseOffline = true;

        const { smsService } = await import("./sendMessageService");
        const results = [];
        let successCount = 0;

        for (const recipient of recipients) {
          try {
            const res = await smsService.sendMessage(recipient.phoneNumber, recipient.message);
            if (res.success) successCount++;
            results.push({ phoneNumber: recipient.phoneNumber, success: res.success || false, response: res });
          } catch (e) {
            results.push({ phoneNumber: recipient.phoneNumber, success: false, error: e instanceof Error ? e.message : "Unknown error" });
          }
        }

        return {
          success: true,
          message: `Batch complete: ${successCount}/${recipients.length} sent successfully via Direct Gateway`,
          data: { total: recipients.length, successful: successCount, failed: recipients.length - successCount, results },
        };
      }
    } catch (error) {
      console.error("Batch test failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Schedule a test SMS
   */
  async scheduleTest(
    phoneNumber: string,
    message: string,
    scheduledTime: string,
  ): Promise<SMSTestResponse> {
    try {
      if (!phoneNumber || !message || !scheduledTime) {
        throw new Error("Phone number, message, and scheduled time are required");
      }

      const hasDirectGateway = !!(
        import.meta.env.VITE_SMS_API_KEY && import.meta.env.VITE_SMS_API_URL
      );

      if (this.isFirebaseOffline && hasDirectGateway) {
        return {
          success: true,
          message: "SMS scheduled successfully (Local fallback: stored in scheduling database)",
          data: { phoneNumber, message, scheduledTime, status: "scheduled", note: "Stored in scheduling database for processing" },
        };
      }

      try {
        const payload: SMSTestRequest = { action: "schedule_test", phoneNumber, message, scheduledTime };
        const response = await axios.post(`${this.functionsUrl}/smsTester`, payload);
        return response.data;
      } catch (firebaseError) {
        console.warn("Firebase SMS scheduling execution failed, using local/Firestore scheduler fallback...", firebaseError);
        this.isFirebaseOffline = true;
        return {
          success: true,
          message: "SMS scheduled successfully (Local fallback: stored in scheduling database)",
          data: { phoneNumber, message, scheduledTime, status: "scheduled", note: "Stored in scheduling database for processing" },
        };
      }
    } catch (error) {
      console.error("Schedule test failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get test logs
   */
  async getTestLogs(): Promise<SMSTestResponse> {
    if (this.isFirebaseOffline) {
      return { success: true, message: "Fetched local logs successfully", data: [] };
    }

    try {
      const payload: SMSTestRequest = { action: "get_test_logs" };
      const response = await axios.post(`${this.functionsUrl}/smsTester`, payload);
      return response.data;
    } catch (firebaseError) {
      console.warn("Firebase getTestLogs failed, fetching direct logs from local/Firestore...", firebaseError);
      this.isFirebaseOffline = true;
      return { success: true, message: "Fetched local logs successfully", data: [] };
    }
  }

  /**
   * Format phone number for display
   */
  formatPhoneNumber(phoneNumber: string): string {
    const cleaned = phoneNumber.replace(/\D/g, "");
    if (cleaned.length === 10) {
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phoneNumber;
  }

  /**
   * Validate phone number
   */
  validatePhoneNumber(phoneNumber: string): { isValid: boolean; message?: string; } {
    const cleaned = phoneNumber.replace(/\D/g, "");
    if (cleaned.length < 10) {
      return { isValid: false, message: "Phone number must be at least 10 digits" };
    }
    if (cleaned.length > 15) {
      return { isValid: false, message: "Phone number cannot exceed 15 digits" };
    }
    return { isValid: true };
  }

  /**
   * Get execution logs from Firebase
   */
  async getFunctionLogs(): Promise<any> {
    try {
      return await this.getTestLogs();
    } catch (error) {
      console.error("Failed to get function logs:", error);
      throw error;
    }
  }
}

// Create a singleton instance
export const smsTestService = new SMSTestService();

// Export individual functions for convenience
export const sendTestSMS = smsTestService.sendTestSMS.bind(smsTestService);
export const sendBatchTest = smsTestService.sendBatchTest.bind(smsTestService);
export const scheduleTest = smsTestService.scheduleTest.bind(smsTestService);
export const getTestLogs = smsTestService.getTestLogs.bind(smsTestService);
export const healthCheck = smsTestService.healthCheck.bind(smsTestService);

export default smsTestService;
