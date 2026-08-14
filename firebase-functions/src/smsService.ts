import * as admin from 'firebase-admin';
import axios from 'axios';

admin.initializeApp();
export const db = admin.firestore();

export class SMSService {
  private apiKey: string;
  private senderId: string;
  private apiUrl: string;

  constructor() {
    this.apiKey = process.env.SMS_API_KEY || "";
    this.senderId = process.env.SMS_SENDER_ID || "";
    this.apiUrl = process.env.SMS_API_URL || "";
  }

  async sendMessage(phoneNumber: string, message: string) {
    try {
      if (!phoneNumber || !message) {
        throw new Error('Phone number and message are required');
      }

      const cleanPhoneNumber = phoneNumber.replace(/\D/g, '');
      if (cleanPhoneNumber.length < 10) {
        throw new Error('Invalid phone number format');
      }

      const formData = new URLSearchParams();
      formData.append("key", this.apiKey);
      formData.append("contacts", cleanPhoneNumber);
      formData.append("senderid", this.senderId);
      formData.append("msg", message);

      const response = await axios.post(this.apiUrl, formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        validateStatus: () => true,
      });

      const responseText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
      
      let data: any;
      try {
        data = typeof response.data === 'object' ? response.data : JSON.parse(responseText);
        data.success = true;
      } catch (e) {
        const isSuccess = responseText.includes('success') || 
                         responseText.includes('sent') ||
                         responseText.includes('SMS-SHOOT-ID') ||
                         responseText.includes('delivered');
        data = { response: responseText, isRawText: true, success: isSuccess };
      }

      return data;
    } catch (error) {
      console.error("Error sending SMS:", error);
      throw error;
    }
  }

  async logSMSResult(logData: any) {
    try {
      await db.collection('sms_test_logs').add({
        ...logData,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error logging SMS result:", error);
    }
  }
}
