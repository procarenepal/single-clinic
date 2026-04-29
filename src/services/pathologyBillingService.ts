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
  orderBy,
  Timestamp,
  increment,
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
      const settingsRef = doc(
        db,
        PATHOLOGY_BILLING_SETTINGS_COLLECTION,
        clinicId,
      );
      const settingsDoc = await getDoc(settingsRef);

      if (!settingsDoc.exists()) {
        throw new Error("Pathology billing settings not found for clinic");
      }

      const settings = settingsDoc.data() as PathologyBillingSettings;
      const invoiceNumber = `${settings.invoicePrefix}-${settings.nextInvoiceNumber.toString().padStart(4, "0")}`;

      // Increment the next invoice number
      await updateDoc(settingsRef, {
        nextInvoiceNumber: increment(1),
        updatedAt: Timestamp.now(),
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

      // Filter out undefined values to prevent Firestore errors
      const cleanedData: any = {};

      Object.keys(billingData).forEach((key) => {
        const value = (billingData as any)[key];

        if (value !== undefined) {
          cleanedData[key] = value;
        }
      });

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

      // Filter out undefined values to prevent Firestore errors
      const cleanedData: any = {};

      Object.keys(billingData).forEach((key) => {
        const value = (billingData as any)[key];

        if (value !== undefined) {
          cleanedData[key] = value;
        }
      });

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
      let q = query(
        billingRef,
        where("clinicId", "==", clinicId),
      );

      if (branchId) {
        q = query(
          billingRef,
          where("clinicId", "==", clinicId),
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
   * Record payment for an invoice
   */
  async recordPayment(
    id: string,
    paymentAmount: number,
    paymentMethod: string,
    paymentReference?: string,
    paymentNotes?: string,
  ): Promise<void> {
    try {
      const billing = await this.getBillingById(id);

      if (!billing) {
        throw new Error("Billing record not found");
      }

      const newPaidAmount = billing.paidAmount + paymentAmount;
      const newBalanceAmount = billing.totalAmount - newPaidAmount;

      let paymentStatus: "unpaid" | "partial" | "paid" = "unpaid";

      if (newPaidAmount >= billing.totalAmount) {
        paymentStatus = "paid";
      } else if (newPaidAmount > 0) {
        paymentStatus = "partial";
      }

      // Prepare update data, only including non-empty optional fields
      const updateData: Partial<PathologyBilling> = {
        paidAmount: newPaidAmount,
        balanceAmount: newBalanceAmount,
        paymentStatus,
        paymentMethod,
        paymentDate: new Date(),
        status: paymentStatus === "paid" ? "paid" : billing.status,
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
