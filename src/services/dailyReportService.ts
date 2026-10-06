import { patientService } from "./patientService";
import { appointmentService } from "./appointmentService";
import { appointmentBillingService } from "./appointmentBillingService";
import { pharmacyService } from "./pharmacyService";
import { walletService } from "./walletService";

import { Patient, Appointment, WalletTransaction } from "@/types/models";
import {
  summariseCashCollections,
  splitRevenueByLineKind,
  type CashCollectionSummary,
  type RevenueByKind,
} from "@/services/core/cashLedgerCore";

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
  /**
   * Whether the invoice itself was created on the selected date, vs. only
   * receiving a payment on it (e.g. clearing a due from an older invoice).
   * "Revenue" cards should count only isCreatedToday invoices; "Collected"
   * cards sum paidAmount across ALL of them — so a same-day due payment on
   * an old invoice can make Collected exceed Revenue for a category. This
   * flag lets the UI split that out instead of presenting one "Collected"
   * number that silently mixes today's sales with old-due clearance.
   */
  isCreatedToday: boolean;
  /**
   * The individual payments recorded against this invoice on the selected
   * date, with how each was funded. `paidAmount` is their sum; this keeps
   * the funding method so wallet-funded payments (internal transfers of
   * money already recognised at deposit time) can be excluded from the
   * day's cash collections instead of being counted a second time.
   */
  paymentsToday?: Array<{ amount: number; method?: string }>;
  /**
   * This invoice's revenue attributed to what was actually sold. A single
   * billing-counter invoice can contain a consultation, lab tests and
   * medicines, so categorising by the collection it came from reported all
   * of it as clinical and left pharmacy/pathology at zero.
   */
  revenueByKind?: RevenueByKind;
}

export interface DailyReportData {
  patients: Patient[];
  appointments: Appointment[];
  billing: DailyBillingSummary[];
  /** Wallet movements on this date — where front-desk cash first lands. */
  walletTransactions: WalletTransaction[];
  /**
   * What the clinic actually collected today, reconciled so that a deposit
   * applied to an invoice the same day is not counted twice.
   */
  cash: CashCollectionSummary;
}

/**
 * Service for fetching daily report data
 */
export const dailyReportService = {
  /**
   * Get patients registered on a specific date
   * @param {string} clinicId - ID of the clinic
   * @param {Date} date - Date to get patients for
   * @returns {Promise<Patient[]>} - Array of patients registered on the date
   */
  async getDailyPatients(
    clinicId: string,
    date: Date,
  ): Promise<Patient[]> {
    try {
      const allPatients = await patientService.getPatientsByClinic(clinicId);

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
   * @returns {Promise<Appointment[]>} - Array of appointments for the date
   */
  async getDailyAppointments(
    clinicId: string,
    date: Date,
  ): Promise<Appointment[]> {
    try {
      return await appointmentService.getAppointmentsByDate(date, clinicId);
    } catch (error) {
      console.error("Error fetching daily appointments:", error);
      throw error;
    }
  },

  /**
   * Get unified appointment and pharmacy billing/invoices for a specific date
   * @param {string} clinicId - ID of the clinic
   * @param {Date} date - Date to get billing for
   * @returns {Promise<DailyBillingSummary[]>} - Array of billing records for the date
   */
  async getDailyBilling(
    clinicId: string,
    date: Date,
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
          appointmentBillingService.getBillingByClinic(clinicId),
          pharmacyService.getMedicinePurchasesByClinic(clinicId),
          pathologyBillingService.getBillingByClinic(clinicId),
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
        status?: string,
        /**
         * The invoice's own lines. A unified counter invoice can carry
         * services, lab tests and medicines together, so revenue has to be
         * attributed by what was sold rather than by which collection the
         * invoice happens to live in.
         */
        lineItems?: Array<{ amount?: number; lineKind?: string | null }>,
      ) => {
        // A cancelled invoice never counts as revenue — matches how the
        // Reports > Pathology tab already excludes cancelled invoices;
        // this shared helper previously didn't, so a same-day cancelled
        // appointment invoice still inflated Daily Report revenue.
        if (status === "cancelled") return;

        let paidToday = 0;
        let hasPaymentToday = false;
        // Each payment taken today, with how it was funded. A payment whose
        // method is "wallet" is an internal transfer of money already
        // recognised on the day its deposit was taken, so cash reporting
        // must be able to tell the two apart (see cashLedgerCore).
        const paymentsToday: Array<{ amount: number; method?: string }> = [];

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
              paymentsToday.push({ amount: p.amount, method: p.method });
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
            isCreatedToday,
            paymentsToday,
            // Pharmacy and pathology module invoices are wholly their own
            // kind; an appointment invoice is split by its lines, because
            // the billing counter can put all three on one bill.
            revenueByKind:
              type === "appointment"
                ? splitRevenueByLineKind(lineItems, totalAmount)
                : {
                  clinical: 0,
                  pathology: type === "pathology" ? totalAmount : 0,
                  pharmacy: type === "pharmacy" ? totalAmount : 0,
                },
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
          (billing as any).status,
          (billing as any).items,
        );
      });

      allPurchases.forEach((purchase) => {
        const bal =
          purchase.paymentStatus === "paid"
            ? 0
            : (purchase as any).balanceAmount || purchase.netAmount || 0;

        // Net out returns — a returned sale shouldn't overstate revenue.
        const returnedAmount =
          (purchase as any).totalReturnedAmount &&
          (purchase as any).totalReturnedAmount > 0
            ? (purchase as any).totalReturnedAmount
            : ((purchase as any).returns ?? []).reduce(
                (retSum: number, r: any) =>
                  retSum + Math.abs(r.totalAmount || 0),
                0,
              );
        const netAmount = Math.max(
          0,
          (purchase.netAmount || 0) - returnedAmount,
        );

        processInvoice(
          purchase.id,
          "pharmacy",
          purchase.purchaseNo,
          purchase.patientName || "Walk-in Customer",
          netAmount,
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
          (billing as any).status,
        );
      });

      return summaries.sort((a, b) => b.date.getTime() - a.date.getTime());
    } catch (error) {
      console.error("Error fetching daily billing:", error);
      throw error;
    }
  },

  /**
   * Wallet movements for the day — where front-desk cash first lands,
   * before any invoice exists for it.
   */
  async getDailyWalletActivity(
    clinicId: string,
    date: Date,
  ): Promise<WalletTransaction[]> {
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
      999,
    );

    try {
      return await walletService.getClinicTransactionsInRange(
        clinicId,
        startOfDay,
        endOfDay,
      );
    } catch (error) {
      // Never let the wallet read break the rest of the report.
      console.error("Error fetching daily wallet activity:", error);

      return [];
    }
  },

  async getDailyReportData(
    clinicId: string,
    date: Date,
  ): Promise<DailyReportData> {
    try {
      const [patients, appointments, billing, walletTransactions] =
        await Promise.all([
          this.getDailyPatients(clinicId, date),
          this.getDailyAppointments(clinicId, date),
          this.getDailyBilling(clinicId, date),
          this.getDailyWalletActivity(clinicId, date),
        ]);

      // Front-desk cash goes into a wallet at check-in and only reaches an
      // invoice at checkout, so invoice payment history alone misses money
      // taken today for a visit that checks out later (or never). Deposits
      // are recognised on the day they arrive; invoice payments funded FROM
      // wallet are treated as internal transfers so nothing is counted
      // twice. See cashLedgerCore for the rule and its tests.
      const deposits = walletTransactions
        .filter((t) => t.type === "deposit")
        .map((t) => ({
          amount: t.amount,
          paymentMethod: t.paymentMethod,
          patientId: t.patientId,
        }));

      const cash = summariseCashCollections({
        walletDeposits: deposits,
        invoicePayments: billing.flatMap((b) =>
          (b.paymentsToday || []).map((p) => ({
            amount: p.amount,
            method: p.method,
            invoiceId: b.id,
          })),
        ),
      });

      return {
        patients,
        appointments,
        billing,
        walletTransactions,
        cash,
      };
    } catch (error) {
      console.error("Error fetching daily report data:", error);
      throw error;
    }
  },
};
