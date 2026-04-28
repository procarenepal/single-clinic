import { patientService } from "./patientService";
import { appointmentService } from "./appointmentService";
import { appointmentBillingService } from "./appointmentBillingService";

import { Patient, Appointment, AppointmentBilling } from "@/types/models";

export interface DailyReportData {
  patients: Patient[];
  appointments: Appointment[];
  billing: AppointmentBilling[];
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
   * Get appointment billing/invoices for a specific date
   * @param {string} clinicId - ID of the clinic
   * @param {Date} date - Date to get billing for
   * @param {string} [branchId] - Optional branch ID to filter billing by
   * @returns {Promise<AppointmentBilling[]>} - Array of billing records for the date
   */
  async getDailyBilling(
    clinicId: string,
    date: Date,
    branchId?: string,
  ): Promise<AppointmentBilling[]> {
    try {
      const allBilling = await appointmentBillingService.getBillingByClinic(
        clinicId,
        branchId,
      );

      // Filter billing by invoice date
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

      return allBilling.filter((billing) => {
        const invoiceDate = billing.invoiceDate;

        if (!invoiceDate) return false;

        const billingDate = new Date(invoiceDate);

        return billingDate >= startOfDay && billingDate <= endOfDay;
      });
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
