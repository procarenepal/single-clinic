import { patientService } from "./patientService";
import { appointmentService } from "./appointmentService";
import { appointmentBillingService } from "./appointmentBillingService";
import { pharmacyService } from "./pharmacyService";

import { Patient, Appointment } from "@/types/models";

export interface DailyBillingSummary {
  id: string;
  type: "appointment" | "pharmacy" | "pathology";
  invoiceNumber: string;
  patientName: string;
  totalAmount: number;
  paidAmount: number; // Amount paid ON the selected date
  balanceAmount: number;
  date: Date; // Date of the invoice or payment
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
      ).getTime();
      const endOfDay = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        23,
        59,
        59,
      ).getTime();

      // Include pathologyBillingService
      const { pathologyBillingService } = await import(
        "./pathologyBillingService"
      );

      const [allAppointmentBilling, allPurchases, allPathologyBilling] =
        await Promise.all([
          appointmentBillingService.getBillingByClinic(clinicId, branchId),
          pharmacyService.getMedicinePurchasesByClinic(clinicId, branchId),
          pathologyBillingService.getBillingByClinic(clinicId, branchId),
        ]);

      const summaries: DailyBillingSummary[] = [];

      const processInvoice = (
        id: string,
        type: "appointment" | "pharmacy" | "pathology",
        invoiceNumber: string,
        patientName: string,
        totalAmount: number,
        balanceAmount: number,
        paymentStatus: string,
        doctorName: string,
        createdDate: Date | null,
        paymentHistory: any[] | undefined,
      ) => {
        let paidToday = 0;
        let hasPaymentToday = false;

        // Sum payments made exactly on this date
        if (paymentHistory && paymentHistory.length > 0) {
          paymentHistory.forEach((p: any) => {
            let pDate = p.date || p.paymentDate;
            let pTime = 0;

            if (pDate) {
              if (typeof pDate.toDate === "function") {
                pTime = pDate.toDate().getTime();
              } else if (pDate.seconds !== undefined) {
                pTime = pDate.seconds * 1000;
              } else {
                pTime = new Date(pDate).getTime();
              }
            }

            if (pTime >= startOfDay && pTime <= endOfDay) {
              paidToday += p.amount;
              hasPaymentToday = true;
            }
          });
        } else {
          // Fallback if no paymentHistory but it was paid/created today
          const cTime = createdDate ? createdDate.getTime() : 0;

          if (
            cTime >= startOfDay &&
            cTime <= endOfDay &&
            paymentStatus === "paid"
          ) {
            paidToday = totalAmount;
          }
        }

        const createdTime = createdDate ? createdDate.getTime() : 0;
        const isCreatedToday =
          createdTime >= startOfDay && createdTime <= endOfDay;

        // Include if invoice was created today OR received a payment today
        if (isCreatedToday || hasPaymentToday) {
          summaries.push({
            id,
            type,
            invoiceNumber,
            patientName: patientName || "Unknown",
            totalAmount,
            paidAmount: paidToday, // Cash collected today
            balanceAmount,
            date: createdDate || new Date(),
            paymentStatus: paymentStatus || "unpaid",
            doctorName,
          });
        }
      };

      allAppointmentBilling.forEach((billing) => {
        processInvoice(
          billing.id,
          "appointment",
          billing.invoiceNumber,
          billing.patientName,
          billing.totalAmount || 0,
          billing.balanceAmount || 0,
          billing.paymentStatus || "unpaid",
          billing.doctorName || "",
          billing.invoiceDate ? new Date(billing.invoiceDate) : null,
          billing.paymentHistory,
        );
      });

      allPurchases.forEach((purchase) => {
        const bal =
          purchase.paymentStatus === "paid"
            ? 0
            : (purchase as any).balanceAmount || purchase.netAmount || 0;

        processInvoice(
          purchase.id,
          "pharmacy",
          purchase.purchaseNo,
          purchase.patientName || "Walk-in Customer",
          purchase.netAmount || 0,
          bal,
          purchase.paymentStatus || "unpaid",
          "Pharmacy Counter",
          purchase.purchaseDate ? new Date(purchase.purchaseDate) : null,
          purchase.paymentHistory,
        );
      });

      allPathologyBilling.forEach((billing) => {
        processInvoice(
          billing.id,
          "pathology",
          billing.invoiceNumber,
          billing.patientName,
          billing.totalAmount || 0,
          billing.balanceAmount || 0,
          billing.paymentStatus || "unpaid",
          "Pathology Lab",
          billing.invoiceDate ? new Date(billing.invoiceDate) : null,
          billing.paymentHistory,
        );
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
