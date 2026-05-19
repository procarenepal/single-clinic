import { patientService } from "./patientService";
import { appointmentService } from "./appointmentService";
import { appointmentBillingService } from "./appointmentBillingService";
import { pharmacyService } from "./pharmacyService";

import { Patient, Appointment } from "@/types/models";

export interface DailyBillingSummary {
  id: string;
  type: 'appointment' | 'pharmacy';
  invoiceNumber: string;
  patientName: string;
  totalAmount: number;
  date: Date;
  paymentStatus: string;
  doctorName?: string;
}

export interface DailyReportData {
  patients: Patient[];
  appointments: Appointment[];
  billing: DailyBillingSummary[];
}

/**
 * Service for fetching daily report data
 */
export const dailyReportService = {
  /**
   * Get patients registered on a specific date
   * @param {string} clinicId - ID of the clinic
   * @param {Date} date - Date to get patients for
   * @param {string} [branchId] - Optional branch ID to filter patients by
   * @returns {Promise<Patient[]>} - Array of patients registered on the date
   */
  async getDailyPatients(
    clinicId: string,
    date: Date,
    branchId?: string,
  ): Promise<Patient[]> {
    try {
      const allPatients = await patientService.getPatientsByClinic(
        clinicId,
        branchId,
      );

      // Filter patients by registration date (createdAt)
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

      return allPatients.filter((patient) => {
        const createdAt = patient.createdAt;

        if (!createdAt) return false;

        const patientDate = new Date(createdAt);

        return patientDate >= startOfDay && patientDate <= endOfDay;
      });
    } catch (error) {
      console.error("Error fetching daily patients:", error);
      throw error;
    }
  },

  /**
   * Get appointments for a specific date
   * @param {string} clinicId - ID of the clinic
   * @param {Date} date - Date to get appointments for
   * @param {string} [branchId] - Optional branch ID to filter appointments by
   * @returns {Promise<Appointment[]>} - Array of appointments for the date
   */
  async getDailyAppointments(
    clinicId: string,
    date: Date,
    branchId?: string,
  ): Promise<Appointment[]> {
    try {
      return await appointmentService.getAppointmentsByDate(
        date,
        clinicId,
        branchId,
      );
    } catch (error) {
      console.error("Error fetching daily appointments:", error);
      throw error;
    }
  },

  /**
   * Get unified appointment and pharmacy billing/invoices for a specific date
   * @param {string} clinicId - ID of the clinic
   * @param {Date} date - Date to get billing for
   * @param {string} [branchId] - Optional branch ID to filter billing by
   * @returns {Promise<DailyBillingSummary[]>} - Array of billing records for the date
   */
  async getDailyBilling(
    clinicId: string,
    date: Date,
    branchId?: string,
  ): Promise<DailyBillingSummary[]> {
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

      const [allBilling, allPurchases] = await Promise.all([
        appointmentBillingService.getBillingByClinic(clinicId, branchId),
        pharmacyService.getMedicinePurchasesByClinic(clinicId, branchId)
      ]);

      const summaries: DailyBillingSummary[] = [];

      allBilling.forEach(billing => {
        const invoiceDate = billing.invoiceDate ? new Date(billing.invoiceDate) : null;
        if (invoiceDate && invoiceDate >= startOfDay && invoiceDate <= endOfDay) {
          summaries.push({
            id: billing.id,
            type: 'appointment',
            invoiceNumber: billing.invoiceNumber,
            patientName: billing.patientName || 'Unknown Patient',
            totalAmount: billing.totalAmount || 0,
            date: invoiceDate,
            paymentStatus: billing.paymentStatus || 'unpaid',
            doctorName: billing.doctorName,
          });
        }
      });

      allPurchases.forEach(purchase => {
        const purchaseDate = purchase.purchaseDate ? new Date(purchase.purchaseDate) : null;
        if (purchaseDate && purchaseDate >= startOfDay && purchaseDate <= endOfDay) {
          summaries.push({
            id: purchase.id,
            type: 'pharmacy',
            invoiceNumber: purchase.purchaseNo,
            patientName: purchase.patientName || 'Walk-in Customer',
            totalAmount: purchase.netAmount || 0,
            date: purchaseDate,
            paymentStatus: purchase.paymentStatus || 'unpaid',
            doctorName: 'Pharmacy Counter',
          });
        }
      });

      return summaries.sort((a, b) => b.date.getTime() - a.date.getTime());
    } catch (error) {
      console.error("Error fetching daily billing:", error);
      throw error;
    }
  },

  /**
   * Get all daily report data for a specific date
   * @param {string} clinicId - ID of the clinic
   * @param {Date} date - Date to get report for
   * @param {string} [branchId] - Optional branch ID to scope report to a single branch
   * @returns {Promise<DailyReportData>} - Complete daily report data
   */
  async getDailyReportData(
    clinicId: string,
    date: Date,
    branchId?: string,
  ): Promise<DailyReportData> {
    try {
      const [patients, appointments, billing] = await Promise.all([
        this.getDailyPatients(clinicId, date, branchId),
        this.getDailyAppointments(clinicId, date, branchId),
        this.getDailyBilling(clinicId, date, branchId),
      ]);

      return {
        patients,
        appointments,
        billing,
      };
    } catch (error) {
      console.error("Error fetching daily report data:", error);
      throw error;
    }
  },
};
