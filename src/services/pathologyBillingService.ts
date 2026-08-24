import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  query,
  where,
  Timestamp,
  increment,
  runTransaction,
} from "firebase/firestore";

import { db } from "../config/firebase";
import {
  PathologyBilling,
  PathologyBillingSettings,
  PathologyBillingItem,
} from "../types/models";

import { doctorCommissionService } from "./doctorCommissionService";
import { referralCommissionService } from "./referralCommissionService";

const PATHOLOGY_BILLING_COLLECTION = "pathologyBilling";
const PATHOLOGY_BILLING_SETTINGS_COLLECTION = "pathologyBillingSettings";

/**
 * Service for managing pathology billing operations including invoices and settings
 */
export const pathologyBillingService = {
  // =================== PATHOLOGY BILLING SETTINGS ===================

  /**
   * Get pathology billing settings for a clinic
   */
  async getBillingSettings(
    clinicId: string,
  ): Promise<PathologyBillingSettings | null> {
    try {
      const settingsRef = doc(
        db,
        PATHOLOGY_BILLING_SETTINGS_COLLECTION,
        clinicId,
      );
      const settingsDoc = await getDoc(settingsRef);

      if (settingsDoc.exists()) {
        const data = settingsDoc.data();
        const settings = {
          id: settingsDoc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as PathologyBillingSettings;

        // Auto-migrate: If paymentMethods doesn't exist, initialize with defaults
        if (!Array.isArray(settings.paymentMethods)) {
          const defaultSettings = this.getDefaultBillingSettings(
            clinicId,
            "system",
          );

          settings.paymentMethods = defaultSettings.paymentMethods;
          settings.defaultPaymentMethod = defaultSettings.defaultPaymentMethod;

          // Update the database with the new payment methods
          await updateDoc(settingsRef, {
            paymentMethods: settings.paymentMethods,
            defaultPaymentMethod: settings.defaultPaymentMethod,
            updatedAt: Timestamp.now(),
          });
        }

        return settings;
      }

      return null;
    } catch (error) {
      console.error("Error getting pathology billing settings:", error);
      throw error;
    }
  },

  /**
   * Create or update pathology billing settings for a clinic
   */
  async updateBillingSettings(
    clinicId: string,
    branchId: string,
    settings: Partial<PathologyBillingSettings>,
    updatedBy: string,
  ): Promise<void> {
    try {
      const settingsRef = doc(
        db,
        PATHOLOGY_BILLING_SETTINGS_COLLECTION,
        clinicId,
      );
      const now = Timestamp.now();

      const data = {
        ...settings,
        clinicId,
        branchId,
        updatedAt: now,
        updatedBy,
      };

      // Check if settings exist
      const existingSettings = await getDoc(settingsRef);

      if (existingSettings.exists()) {
        await updateDoc(settingsRef, data);
      } else {
        // Create new settings with defaults
        const defaultSettings = this.getDefaultBillingSettings(
          clinicId,
          updatedBy,
        );

        await setDoc(settingsRef, {
          ...defaultSettings,
          ...data,
          branchId,
          createdAt: now,
        });
      }
    } catch (error) {
      console.error("Error updating pathology billing settings:", error);
      throw error;
    }
  },

  /**
   * Get default billing settings for new clinics
   */
  getDefaultBillingSettings(
    clinicId: string,
    createdBy: string,
  ): PathologyBillingSettings {
    return {
      id: clinicId,
      clinicId,
      branchId: "",
      enabledByAdmin: false,
      isActive: false,
      invoicePrefix: "PATH-INV",
      nextInvoiceNumber: 1,
      defaultDiscountType: "percent",
      defaultDiscountValue: 0,
      enableTax: false,
      defaultTaxPercentage: 0,
      taxLabel: "Tax",
      paymentMethods: [
        {
          id: crypto.randomUUID(),
          name: "Cash",
          key: "cash",
          isEnabled: true,
          requiresReference: false,
          icon: "💵",
          description: "Cash payment",
          isCustom: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          updatedBy: createdBy,
        },
        {
          id: crypto.randomUUID(),
          name: "Credit/Debit Card",
          key: "card",
          isEnabled: true,
          requiresReference: true,
          icon: "💳",
          description: "Credit or debit card payment",
          isCustom: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          updatedBy: createdBy,
        },
        {
          id: crypto.randomUUID(),
          name: "eSewa",
          key: "esewa",
          isEnabled: true,
          requiresReference: true,
          icon: "📱",
          description: "eSewa digital wallet",
          isCustom: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          updatedBy: createdBy,
        },
        {
          id: crypto.randomUUID(),
          name: "Khalti",
          key: "khalti",
          isEnabled: true,
          requiresReference: true,
          icon: "📲",
          description: "Khalti digital wallet",
          isCustom: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          updatedBy: createdBy,
        },
        {
          id: crypto.randomUUID(),
          name: "Bank Transfer",
          key: "bank_transfer",
          isEnabled: false,
          requiresReference: true,
          icon: "🏦",
          description: "Bank transfer or online banking",
          isCustom: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          updatedBy: createdBy,
        },
        {
          id: crypto.randomUUID(),
          name: "Cheque",
          key: "cheque",
          isEnabled: false,
          requiresReference: true,
          icon: "📋",
          description: "Cheque payment",
          isCustom: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          updatedBy: createdBy,
        },
      ],
      defaultPaymentMethod: "cash",
      createdAt: new Date(),
      updatedAt: new Date(),
      updatedBy: createdBy,
    };
  },

  // =================== INVOICE OPERATIONS ===================

  /**
   * Generate next invoice number for a clinic
   */
  async generateInvoiceNumber(clinicId: string): Promise<string> {
    try {
      const { getNepaliFiscalYear } = await import("./irdCbmsService");
      const currentRealFiscalYear = getNepaliFiscalYear(new Date());

      const settingsRef = doc(
        db,
        PATHOLOGY_BILLING_SETTINGS_COLLECTION,
        clinicId,
      );

      const invoiceNumber = await runTransaction(db, async (transaction) => {
        const settingsDoc = await transaction.get(settingsRef);

        if (!settingsDoc.exists()) {
          throw new Error("Pathology billing settings not found for clinic");
        }

        const settings = settingsDoc.data() as PathologyBillingSettings;

        let nextInvoiceNum = settings.nextInvoiceNumber || 1;
        const updates: any = {
          updatedAt: Timestamp.now(),
        };

        if (settings.currentFiscalYear !== currentRealFiscalYear) {
          nextInvoiceNum = 1;
          updates.currentFiscalYear = currentRealFiscalYear;
          updates.nextInvoiceNumber = 2; // Next will be 2
        } else {
          updates.nextInvoiceNumber = nextInvoiceNum + 1;
        }

        // Format fiscal year from "2080.81" to "80/81"
        const formattedFiscalYear = currentRealFiscalYear.substring(2).replace('.', '/');
        const generatedInvoiceNumber = `${formattedFiscalYear}-${settings.invoicePrefix}-${nextInvoiceNum.toString().padStart(4, "0")}`;

        // Increment the next invoice number atomically
        transaction.update(settingsRef, updates);

        return generatedInvoiceNumber;
      });

      return invoiceNumber;
    } catch (error) {
      console.error("Error generating pathology invoice number:", error);
      throw error;
    }
  },

  /**
   * Create a new pathology billing record
   */
  async createBilling(
    billingData: Omit<PathologyBilling, "id" | "createdAt" | "updatedAt">,
  ): Promise<string> {
    try {
      const billingRef = collection(db, PATHOLOGY_BILLING_COLLECTION);

      // Recursive function to remove undefined values from objects and arrays
      const cleanUndefined = (obj: any): any => {
        if (obj === undefined) return null;
        if (obj === null || typeof obj !== "object" || obj instanceof Date)
          return obj;

        if (Array.isArray(obj)) {
          return obj.map(cleanUndefined);
        }

        const cleaned: any = {};

        Object.keys(obj).forEach((key) => {
          const value = obj[key];
          const cleanedValue = cleanUndefined(value);

          if (cleanedValue !== undefined) {
            cleaned[key] = cleanedValue;
          }
        });

        return cleaned;
      };

      const cleanedData = cleanUndefined(billingData);
      const now = Timestamp.now();

      const data = {
        ...cleanedData,
        invoiceDate: Timestamp.fromDate(billingData.invoiceDate),
        paymentDate: billingData.paymentDate
          ? Timestamp.fromDate(billingData.paymentDate)
          : null,
        finalizedAt: billingData.finalizedAt
          ? Timestamp.fromDate(billingData.finalizedAt)
          : null,
        createdAt: now,
        updatedAt: now,
      };

      const docRef = await addDoc(billingRef, data);

      console.log("Pathology billing created with ID:", docRef.id);

      // Attempt Java backend sync asynchronously
      try {
        const { billingApi } = await import("./api/billingApi");
        const { clinicSettingsService } = await import("./clinicSettingsService");
        const { getNepaliFiscalYear } = await import("./irdCbmsService");

        const clinicSettings = await clinicSettingsService.getClinicSettings(billingData.clinicId);

        let irdSettings = {};
        if (clinicSettings && clinicSettings.irdEnabled) {
          const { clinicService } = await import("./clinicService");
          const clinic = await clinicService.getClinicById(billingData.clinicId);
          irdSettings = {
            irdEnabled: true,
            irdApiUrl: clinicSettings.irdApiUrl,
            irdApiUsername: clinicSettings.irdApiUsername,
            irdApiPassword: clinicSettings.irdApiPassword,
            sellerPan: clinic?.panNumber || "",
            fiscalYear: getNepaliFiscalYear(new Date()),
          };
        }

        const taxPercentage = billingData.taxPercentage || 0;
        const taxAmount = billingData.taxAmount || 0;
        const totalAmount = billingData.totalAmount || 0;
        let taxableAmount = 0;
        let exemptAmount = 0;

        if (taxPercentage > 0) {
          taxableAmount = totalAmount - taxAmount;
        } else {
          exemptAmount = totalAmount;
        }

        const payload = {
          firebasePatientId: billingData.patientId || "",
          buyerName: billingData.patientName || "Cash Sales",
          buyerPan: "",
          totalAmount,
          taxableAmount,
          taxAmount,
          exemptAmount,
          ...irdSettings,
          items: (billingData.items || []).map((item) => ({
            itemName: item.testName || "Pathology Test",
            quantity: 1,
            rate: item.price || 0,
            totalAmount: item.price || 0,
            isTaxable: taxPercentage > 0,
          })),
        };

        const result = await billingApi.createInvoice(payload);

        if (result?.id) {
          await this.updateBilling(docRef.id, { javaInvoiceId: result.id });
          console.log("Pathology billing synced to Java backend with ID:", result.id);
        }
      } catch (javaError: any) {
        console.warn("Java backend submission skipped or offline:", javaError.message || javaError);
      }

      return docRef.id;
    } catch (error) {
      console.error("Error creating pathology billing:", error);
      throw error;
    }
  },

  /**
   * Update an existing pathology billing record
   */
  async updateBilling(
    id: string,
    billingData: Partial<PathologyBilling>,
  ): Promise<void> {
    try {
      const billingRef = doc(db, PATHOLOGY_BILLING_COLLECTION, id);

      // IRD COMPLIANCE: Block financial field edits on finalized/synced invoices
      const existing = await getDoc(billingRef);
      if (existing.exists()) {
        const existingData = existing.data() as PathologyBilling;
        const isFinalized =
          existingData.irdSynced ||
          existingData.status === "paid" ||
          existingData.status === "finalized";
        const financialFieldsChanged =
          ("totalAmount" in billingData && billingData.totalAmount !== existingData.totalAmount) ||
          ("subtotal" in billingData && billingData.subtotal !== existingData.subtotal) ||
          ("taxAmount" in billingData && billingData.taxAmount !== existingData.taxAmount) ||
          ("discountAmount" in billingData && billingData.discountAmount !== existingData.discountAmount) ||
          ("items" in billingData && JSON.stringify(billingData.items) !== JSON.stringify(existingData.items));

        if (isFinalized && financialFieldsChanged) {
          throw new Error(
            "IRD Tax Compliance Error: Financial fields of a finalized or IRD-synced pathology invoice cannot be modified. Issue a Credit Note to make adjustments.",
          );
        }
      }

      // Recursive function to remove undefined values from objects and arrays
      const cleanUndefined = (obj: any): any => {
        if (obj === undefined) return null;
        if (obj === null || typeof obj !== "object" || obj instanceof Date)
          return obj;

        if (Array.isArray(obj)) {
          return obj.map(cleanUndefined);
        }

        const cleaned: any = {};

        Object.keys(obj).forEach((key) => {
          const value = obj[key];
          const cleanedValue = cleanUndefined(value);

          if (cleanedValue !== undefined) {
            cleaned[key] = cleanedValue;
          }
        });

        return cleaned;
      };

      const cleanedData = cleanUndefined(billingData);

      const data: any = {
        ...cleanedData,
        updatedAt: Timestamp.now(),
      };

      // Convert Date fields to Timestamps
      if (billingData.invoiceDate) {
        data.invoiceDate = Timestamp.fromDate(billingData.invoiceDate);
      }
      if (billingData.paymentDate) {
        data.paymentDate = Timestamp.fromDate(billingData.paymentDate);
      }
      if (billingData.finalizedAt) {
        data.finalizedAt = Timestamp.fromDate(billingData.finalizedAt);
      }

      await updateDoc(billingRef, data);
      console.log("Pathology billing updated:", id);
    } catch (error) {
      console.error("Error updating pathology billing:", error);
      throw error;
    }
  },

  /**
   * Get pathology billing by ID
   */
  async getBillingById(id: string): Promise<PathologyBilling | null> {
    try {
      const billingRef = doc(db, PATHOLOGY_BILLING_COLLECTION, id);
      const billingDoc = await getDoc(billingRef);

      if (billingDoc.exists()) {
        const data = billingDoc.data();

        return {
          id: billingDoc.id,
          ...data,
          invoiceDate: data.invoiceDate?.toDate() || new Date(),
          paymentDate: data.paymentDate?.toDate() || null,
          finalizedAt: data.finalizedAt?.toDate() || null,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as PathologyBilling;
      }

      return null;
    } catch (error) {
      console.error("Error getting pathology billing:", error);
      throw error;
    }
  },

  /**
   * Get all pathology billing records for a clinic
   */
  async getBillingByClinic(
    clinicId: string,
    branchId?: string,
  ): Promise<PathologyBilling[]> {
    try {
      if (!clinicId) {
        throw new Error("Clinic ID is required");
      }

      const billingRef = collection(db, PATHOLOGY_BILLING_COLLECTION);
      let q = query(billingRef, where("clinicId", "==", clinicId));

      if (branchId) {
        q = query(
          billingRef,

          where("branchId", "==", branchId),
        );
      }

      const querySnapshot = await getDocs(q);
      const billings: PathologyBilling[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();

        billings.push({
          id: doc.id,
          ...data,
          invoiceDate: data.invoiceDate?.toDate() || new Date(),
          paymentDate: data.paymentDate?.toDate() || null,
          finalizedAt: data.finalizedAt?.toDate() || null,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as PathologyBilling);
      });

      // Sort by createdAt descending in memory to avoid index error
      return billings.sort((a, b) => {
        const dateA = a.createdAt?.getTime() || 0;
        const dateB = b.createdAt?.getTime() || 0;

        return dateB - dateA;
      });
    } catch (error) {
      console.error("Error getting pathology billing by clinic:", error);
      throw error;
    }
  },

  /**
   * Finalize an invoice (change status from draft to finalized)
   */
  async finalizeInvoice(id: string, finalizedBy: string): Promise<void> {
    try {
      const billing = await this.getBillingById(id);

      if (!billing) {
        throw new Error("Billing record not found");
      }

      await this.updateBilling(id, {
        status: "finalized",
        finalizedBy,
        finalizedAt: new Date(),
      });

      // Note: IRD Sync is now handled by the Java Backend upon creation.

      // Create commissions for referring sources
      if (billing.referringDoctors && billing.referringDoctors.length > 0) {
        for (const refDoc of billing.referringDoctors) {
          if (refDoc.calculatedAmount <= 0) continue;

          if (refDoc.type === "partner") {
            // Handle referral partners
            const partnerData = {
              id: refDoc.doctorId,
              name: refDoc.doctorName,
              defaultCommission: refDoc.commissionValue,
            } as any;

            await referralCommissionService.createPathologyCommission(
              billing,
              partnerData,
              refDoc.calculatedAmount,
              finalizedBy,
            );
          } else {
            // Default to regular doctors
            await doctorCommissionService.createPathologyCommissions(
              { ...billing, referringDoctors: [refDoc] } as any,
              finalizedBy,
            );
          }
        }
      }
    } catch (error) {
      console.error("Error finalizing pathology invoice:", error);
      throw error;
    }
  },

  /**
   * Issue a Credit Note (Sales Return) for a finalized/synced invoice
   */
  async issueCreditNote(originalBillingId: string, reason: string, createdBy: string): Promise<string> {
    try {
      const original = await this.getBillingById(originalBillingId);
      if (!original) throw new Error("Original billing record not found");

      if (!original.irdSynced) {
        throw new Error("Can only issue Credit Notes for IRD-synced invoices. For unsynced invoices, simply edit or cancel them.");
      }

      // Generate negative items
      const negativeItems = original.items.map(item => ({
        ...item,
        price: -Math.abs(item.price || 0),
        amount: -Math.abs(item.amount),
      }));

      // Generate invoice number
      const nextInvoiceNumber = await this.generateInvoiceNumber(original.clinicId);
      const creditNoteInvoiceNumber = `CN-${nextInvoiceNumber}`;

      const creditNoteData: Omit<PathologyBilling, "id" | "createdAt" | "updatedAt"> = {
        ...original,
        invoiceNumber: creditNoteInvoiceNumber,
        invoiceDate: new Date(),
        items: negativeItems,
        
        // Reverse amounts
        subtotal: -Math.abs(original.subtotal),
        discountAmount: -Math.abs(original.discountAmount),
        taxAmount: -Math.abs(original.taxAmount),
        totalAmount: -Math.abs(original.totalAmount),
        
        // Mark as paid since it's a refund
        status: "finalized",
        paymentStatus: "paid",
        paidAmount: -Math.abs(original.totalAmount),
        balanceAmount: 0,
        
        // Credit note links
        isCreditNote: true,
        linkedInvoiceId: original.id,
        creditNoteReason: reason,
        notes: `Credit Note for Invoice ${original.invoiceNumber}. Reason: ${reason}`,
        
        // Reset sync status
        irdSynced: false,
        irdSyncDate: undefined,
        cbmsResponseCode: undefined,
        
        createdBy,
        finalizedBy: createdBy,
        finalizedAt: new Date(),
        
        // Remove old payment history
        paymentHistory: [],
      };

      const newCreditNoteId = await this.createBilling(creditNoteData);

      // Trigger IRD CBMS Sync for Sales Return (Credit Note)
      try {
        const { clinicSettingsService } = await import("./clinicSettingsService");
        const { clinicService } = await import("./clinicService");
        const { syncInvoiceToIRD } = await import("./irdCbmsService");

        const clinicSettings = await clinicSettingsService.getClinicSettings(original.clinicId);
        const clinic = await clinicService.getClinicById(original.clinicId);

        if (clinicSettings && clinic && clinicSettings.irdEnabled) {
          const syncRes = await syncInvoiceToIRD({
            clinicSettings,
            clinic,
            invoiceData: {
              buyerName: original.patientName || "Cash Sales",
              buyerPan: "",
              invoiceNumber: creditNoteInvoiceNumber,
              invoiceDate: new Date(),
              totalAmount: Math.abs(original.totalAmount),
              taxAmount: Math.abs(original.taxAmount || 0),
              isTaxEnabled: (original.taxPercentage || 0) > 0,
            },
            isReturn: true,
          });

          await this.updateBilling(newCreditNoteId, {
            irdSynced: syncRes.success,
            irdSyncDate: new Date(),
            cbmsResponseCode: syncRes.responseCode,
          });
        }
      } catch (irdErr) {
        console.warn("Failed to sync Pathology Credit Note to IRD API:", irdErr);
      }

      // Update original invoice to note it has been reversed
      await this.updateBilling(original.id, {
        notes: (original.notes ? original.notes + '\n' : '') + `Reversed by Credit Note ${creditNoteInvoiceNumber} on ${new Date().toLocaleDateString()}`,
      });

      return newCreditNoteId;
    } catch (error) {
      console.error("Error issuing credit note:", error);
      throw error;
    }
  },

  /**
   * Record payment for an invoice
   */
  async recordPayment(
    id: string,
    paymentAmount: number,
    paymentMethod: string,
    paymentReference?: string,
    paymentNotes?: string,
    recordedBy?: string,
    discountAmount: number = 0,
  ): Promise<void> {
    try {
      const billing = await this.getBillingById(id);

      if (!billing) {
        throw new Error("Billing record not found");
      }

      if (billing.paymentStatus === "paid" && paymentAmount > 0) {
        console.warn(`Attempted to record payment on already paid pathology invoice: ${id}`);
        throw new Error("This invoice is already fully paid.");
      }

      const newTotalAmount = Math.max(0, billing.totalAmount - discountAmount);
      const newDiscountAmount = (billing.discountAmount || 0) + discountAmount;
      const newPaidAmount = (billing.paidAmount || 0) + paymentAmount;
      const newBalanceAmount = Math.max(0, newTotalAmount - newPaidAmount);

      let paymentStatus: "unpaid" | "partial" | "paid" = "unpaid";

      if (newPaidAmount >= newTotalAmount) {
        paymentStatus = "paid";
      } else if (newPaidAmount > 0) {
        paymentStatus = "partial";
      }

      // Create payment event
      const paymentEvent = {
        id: Math.random().toString(36).substring(2, 9),
        amount: paymentAmount,
        method: paymentMethod,
        reference: paymentReference || "",
        notes: paymentNotes || "",
        date: new Date(),
        recordedBy: recordedBy || "system",
      };

      const paymentHistory = billing.paymentHistory || [];

      paymentHistory.push(paymentEvent);

      // Prepare update data, only including non-empty optional fields
      const updateData: Partial<PathologyBilling> = {
        totalAmount: newTotalAmount,
        discountAmount: newDiscountAmount,
        paidAmount: newPaidAmount,
        balanceAmount: newBalanceAmount,
        paymentStatus,
        paymentMethod,
        paymentDate: new Date(),
        status: paymentStatus === "paid" ? "paid" : billing.status,
        paymentHistory,
      };

      // Only include paymentReference if it's not empty
      if (paymentReference && paymentReference.trim() !== "") {
        updateData.paymentReference = paymentReference.trim();
      }

      // Only include paymentNotes if it's not empty
      if (paymentNotes && paymentNotes.trim() !== "") {
        updateData.paymentNotes = paymentNotes.trim();
      }

      await this.updateBilling(id, updateData);

      // Auto-create follow-up if paid
      if (
        paymentStatus === "paid" &&
        billing.status !== "paid" &&
        billing.patientId
      ) {
        try {
          const { followupService } = await import("./followupService");
          const { patientService } = await import("./patientService");

          const patient = await patientService.getPatientById(
            billing.patientId,
          );

          if (patient) {
            const services = billing.items
              .map((item) => item.testName)
              .join(" | ");

            await followupService.createFollowup({
              clinicId: billing.clinicId,
              branchId: billing.branchId || "",
              category: "pathology",
              patientId: billing.patientId,
              patientName: patient.name,
              patientMobile: patient.mobile || patient.phone || "",
              visitDate: new Date(),
              session: "1st",
              initStatus: "good",
              overallStatus: "pending",
              service: services,
              createdBy: recordedBy || "system",
            } as any);
            console.log("Auto-created pathology followup for billing", id);
          }
        } catch (e) {
          console.error("Failed to auto-create followup:", e);
        }
      }
    } catch (error) {
      console.error("Error recording pathology payment:", error);
      throw error;
    }
  },

  // =================== UTILITY FUNCTIONS ===================

  /**
   * Calculate invoice totals from items
   */
  calculateInvoiceTotals(
    items: PathologyBillingItem[],
    discountType: "flat" | "percent",
    discountValue: number,
    taxPercentage: number,
  ): {
    subtotal: number;
    discountAmount: number;
    taxAmount: number;
    totalAmount: number;
  } {
    const subtotal = items.reduce((sum, item) => sum + item.amount, 0);

    let discountAmount = 0;

    if (discountType === "flat") {
      discountAmount = Math.min(discountValue, subtotal);
    } else if (discountType === "percent") {
      discountAmount = (subtotal * discountValue) / 100;
    }

    const amountAfterDiscount = subtotal - discountAmount;
    const taxAmount = (amountAfterDiscount * taxPercentage) / 100;
    const totalAmount = amountAfterDiscount + taxAmount;

    return {
      subtotal,
      discountAmount,
      taxAmount,
      totalAmount,
    };
  },
};
