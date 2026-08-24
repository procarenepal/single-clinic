import { smsService } from "./sendMessageService";

export const smsTestService = {
  healthCheck: async () => {
    // For now, assume the service is online if this is called
    // A more thorough check could involve pinging the SMS provider's API endpoint
    return { success: true };
  },

  validatePhoneNumber: (phoneNumber: string) => {
    if (!phoneNumber) return { isValid: false, message: "Phone number is required" };
    const cleanPhone = phoneNumber.replace(/[^\d+]/g, "");
    if (cleanPhone.length < 10) {
      return { isValid: false, message: "Phone number must be at least 10 digits" };
    }
    return { isValid: true };
  },

  sendTestSMS: async (phoneNumber: string, message: string) => {
    try {
      const response = await smsService.sendMessage(phoneNumber, message);
      return { 
        success: response.success, 
        message: response.message
      };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to send SMS" };
    }
  }
};
