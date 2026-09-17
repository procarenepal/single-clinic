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
  runTransaction,
} from "firebase/firestore";

import { db, auth } from "../config/firebase";
import {
  PathologyBilling,
  PathologyBillingSettings,
  PathologyBillingItem,
} from "../types/models";
import { calculateTaxBreakdown } from "../utils/taxEngine";

import { doctorCommissionService } from "./doctorCommissionService";
import { referralCommissionService } from "./referralCommissionService";
import { expertCommissionService } from "./expertCommissionService";
import { staffCommissionService } from "./staffCommissionService";
import { walletService } from "./walletService";

const PATHOLOGY_BILLING_COLLECTION = "pathologyBilling";
const PATHOLOGY_BILLING_SETTINGS_COLLECTION = "pathologyBillingSettings";

/**
 * Reverse every doctor/referral-partner commission tied to a pathology
 * billing (mirrors appointmentBillingService's equivalent) — used when an
 * invoice is cancelled or credit-noted so commission earned on a reversed
 * sale doesn't stay permanently on the books. Failures here are logged, not
 * thrown — the invoice-side cancellation/credit-note must not be blocked by
 * a commission-bookkeeping error.
 */
async function reverseCommissionsForBilling(billingId: string): Promise<void> {
  try {
    const [docComms, refComms, expComms, staffComms] = await Promise.all([
      doctorCommissionService.getCommissionsByBillingId(billingId),
      referralCommissionService.getCommissionsByBillingId(billingId),
      expertCommissionService.getCommissionsByBillingId(billingId),
      staffCommissionService.getCommissionsByBillingId(billingId),
    ]);

    await Promise.all([
      ...docComms
        .filter((c) => c.status !== "cancelled")
        .map((c) => doctorCommissionService.updateCommissionStatus(c.id, "cancelled")),
      ...refComms
        .filter((c) => c.status !== "cancelled")
        .map((c) => referralCommissionService.updateCommissionStatus(c.id, "cancelled")),
      ...expComms
        .filter((c) => c.status !== "cancelled")
        .map((c) => expertCommissionService.updateCommissionStatus(c.id, "cancelled")),
      ...staffComms
        .filter((c) => c.status !== "cancelled")
        .map((c) => staffCommissionService.updateCommissionStatus(c.id, "cancelled")),
    ]);
  } catch (error) {
    console.error("Error reversing commissions for pathology billing:", billingId, error);
  }
}

/**
 * Refund a wallet-paid invoice's collected amount back to the patient's
 * wallet on cancel/credit-note (mirrors appointmentBillingService's
 * equivalent). Only applies when paid via wallet with money collected.
 * Failures are logged, not thrown — must not block the cancel/credit-note.
 */
async function refundWalletIfApplicable(
  billing: PathologyBilling,
  reason: string,
  createdBy: string,
): Promise<void> {
  if (billing.paymentMethod !== "wallet" || !(billing.paidAmount > 0)) {
    return;
  }

  try {
    await walletService.refundFunds(
      billing.patientId,
      billing.clinicId,
      billing.paidAmount,
      billing.id,
      reason,
      createdBy,
    );
  } catch (error) {
    console.error("Error refunding wallet payment for pathology billing:", billing.id, error);
  }
}

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
        branchId: clinicId,
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
        const formattedFiscalYear = currentRealFiscalYear
          .substring(2)
          .replace(".", "/");
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
  /**
   * Create a new pathology billing record.
   *
   * The Java backend + MySQL is the authoritative invoice ledger and IRD sync
   * point: it is called FIRST and BLOCKING, and its response's invoiceNumber
   * is what actually gets persisted here. A Java backend failure throws
   * (surfaced to the caller) rather than silently creating a Firestore-only
   * invoice with no real ledger entry and no invoice number that will ever
   * reach IRD.
   *
   * Returns the authoritative invoiceNumber alongside the Firestore id —
   * callers must use the returned invoiceNumber (not a pre-generated one)
   * for anything shown to the patient (receipts, print, confirmation UI).
   */
  async createBilling(
    billingData: Omit<PathologyBilling, "id" | "createdAt" | "updatedAt">,
  ): Promise<{ id: string; invoiceNumber: string }> {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      throw new Error(
        "You appear to be offline. Please check your internet connection and try again.",
      );
    }

    const { billingApi } = await import("./api/billingApi");
    const { clinicService } = await import("./clinicService");
    const { getNepaliFiscalYear } = await import("./irdCbmsService");
    const { computeIdempotencyKey } = await import(
      "../utils/idempotencyKey"
    );

    // IRD's irdEnabled/credentials live on the Clinic document (that's what
    // Clinic Settings > IRD CBMS Configuration actually writes to) — never
    // on ClinicSettings, which has its own same-named but always-unset field.
    const clinic = await clinicService.getClinicById(billingData.clinicId);

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

    const invoiceItems = (billingData.items || []).map((item) => ({
      itemName: item.testName || "Pathology Test",
      quantity: 1,
      rate: item.price || 0,
      totalAmount: item.price || 0,
      isTaxable: taxPercentage > 0,
    }));

    // Only intent (irdEnabled) travels to the Java backend — actual IRD
    // credentials are resolved server-side per clinic, never sent from here.
    const invoicePayload = {
      firebasePatientId: billingData.patientId || "",
      buyerName: billingData.patientName || "Cash Sales",
      buyerPan: billingData.patientPanVat || "",
      totalAmount,
      taxableAmount,
      taxAmount,
      exemptAmount,
      discountAmount: billingData.discountAmount,
      paymentMethod: billingData.paymentMethod,
      irdEnabled: Boolean(clinic?.irdEnabled),
      fiscalYear: getNepaliFiscalYear(new Date()),
      // Credit notes/sales returns must route to IRD's /api/billreturn, not /api/bill.
      isReturn: Boolean((billingData as any).isCreditNote),
      // Deterministic per-content key — a network-drop retry of this exact
      // submission reuses it, so the backend returns the already-created
      // invoice instead of minting a duplicate.
      idempotencyKey: computeIdempotencyKey({
        clinicId: billingData.clinicId,
        buyerName: billingData.patientName || "Cash Sales",
        totalAmount,
        items: invoiceItems,
      }),
      items: invoiceItems,
    };

    // Blocking, authoritative call. Throws (propagates to caller) on failure —
    // we do not create a Firestore invoice record with no backing ledger entry.
    const javaResult = await billingApi.createInvoice(invoicePayload);

    if (!javaResult?.invoiceNumber) {
      throw new Error(
        "Java backend did not return an invoice number — invoice was not created.",
      );
    }

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
        invoiceNumber: javaResult.invoiceNumber,
        invoiceDate: Timestamp.fromDate(billingData.invoiceDate),
        paymentDate: billingData.paymentDate
          ? Timestamp.fromDate(billingData.paymentDate)
          : null,
        finalizedAt: billingData.finalizedAt
          ? Timestamp.fromDate(billingData.finalizedAt)
          : null,
        javaInvoiceId: javaResult.id,
        irdSynced: Boolean(javaResult.irdSynced),
        irdSyncDate: javaResult.irdSyncDate
          ? new Date(javaResult.irdSyncDate)
          : null,
        cbmsResponseCode: javaResult.cbmsResponseCode || null,
        createdAt: now,
        updatedAt: now,
      };

      const docRef = await addDoc(billingRef, data);

      console.log(
        "Pathology billing created with ID:",
        docRef.id,
        "invoiceNumber:",
        javaResult.invoiceNumber,
      );

      if (!Boolean((billingData as any).isCreditNote)) {
        // Best-effort audit log — logging failures must never mask a
        // successful invoice creation as a save failure.
        try {
          const { auditLogService } = await import("./auditLogService");

          await auditLogService.logDiscountTaxChange({
            performedBy: auth.currentUser?.uid || "system",
            clinicId: billingData.clinicId,
            branchId: (billingData as any).branchId,
            billingId: docRef.id,
            invoiceNumber: javaResult.invoiceNumber,
            after: {
              discountType: (billingData as any).discountType,
              discountValue: (billingData as any).discountValue,
              applyTax: taxPercentage > 0,
              taxPercentage,
            },
          });
        } catch (auditError) {
          console.error("Error logging discount/tax audit event:", auditError);
        }
      }

      return { id: docRef.id, invoiceNumber: javaResult.invoiceNumber };
    } catch (error) {
      console.error("Error creating pathology billing:", error);
      // The ledger entry already exists (javaResult.invoiceNumber was
      // returned) — only the local Firestore copy failed to save. Safe to
      // resubmit: the same idempotencyKey means the Java backend will
      // return this same invoice rather than creating a duplicate.
      throw new Error(
        `Invoice ${javaResult.invoiceNumber} was recorded but could not be saved locally. Please try again — this will not create a duplicate.`,
      );
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
        // Numeric fields are compared with undefined/null normalized to 0 —
        // otherwise re-sending an unchanged-but-previously-unset field (e.g.
        // discountAmount: 0 when the existing record has it as undefined)
        // reads as a "change" and wrongly blocks a legitimate, purely
        // non-financial update like recording a payment.
        const numChanged = (key: "totalAmount" | "subtotal" | "taxAmount" | "discountAmount") =>
          key in billingData &&
          (billingData[key] || 0) !== (existingData[key] || 0);

        const financialFieldsChanged =
          numChanged("totalAmount") ||
          numChanged("subtotal") ||
          numChanged("taxAmount") ||
          numChanged("discountAmount") ||
          ("items" in billingData &&
            JSON.stringify(billingData.items) !==
              JSON.stringify(existingData.items));

        if (isFinalized && financialFieldsChanged) {
          throw new Error(
            "IRD Tax Compliance Error: Financial fields of a finalized or IRD-synced pathology invoice cannot be modified. Issue a Credit Note to make adjustments.",
          );
        }

        // Clause ट covers "any data" (कुनैपनि तथ्याङ्क), not just financial
        // fields — patient identity, doctor, dates etc. must also be frozen
        // once finalized/synced. Only system-driven bookkeeping fields
        // (payment recording, IRD sync retries, cancellation/credit-note
        // linkage) may still change post-finalization.
        if (isFinalized) {
          const allowedPostFinalizeFields = new Set([
            "paidAmount",
            "balanceAmount",
            "paymentStatus",
            "paymentMethod",
            "paymentDate",
            "paymentReference",
            "paymentNotes",
            "paymentHistory",
            "printCount",
            "irdSynced",
            "irdSyncDate",
            "cbmsResponseCode",
            "status",
            "hasCreditNote",
            "finalizedBy",
            "finalizedAt",
          ]);
          const financialKeys = [
            "totalAmount",
            "subtotal",
            "taxAmount",
            "discountAmount",
          ];

          for (const key of Object.keys(billingData)) {
            if (financialKeys.includes(key) || key === "items") continue;
            if (allowedPostFinalizeFields.has(key)) continue;

            if (key === "notes") {
              const oldNotes = existingData.notes || "";
              const newNotes = (billingData as any).notes || "";

              if (newNotes === oldNotes || newNotes.startsWith(oldNotes)) continue;

              throw new Error(
                "IRD Tax Compliance Error: Notes on a finalized or IRD-synced pathology invoice can only be appended to (e.g. cancellation/credit-note remarks), not rewritten.",
              );
            }

            const oldVal = (existingData as any)[key];
            const newVal = (billingData as any)[key];
            const changed =
              typeof newVal === "object" && newVal !== null
                ? JSON.stringify(newVal) !== JSON.stringify(oldVal)
                : newVal !== oldVal;

            if (changed) {
              throw new Error(
                "IRD Tax Compliance Error: Data of a finalized or IRD-synced pathology invoice cannot be modified. Issue a Credit Note to make adjustments.",
              );
            }
          }
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

      if (existing.exists()) {
        const existingData = existing.data() as PathologyBilling;
        const discountTaxKeys = ["discountType", "discountValue", "taxPercentage"] as const;
        const discountTaxChanged = discountTaxKeys.some(
          (k) =>
            k in billingData &&
            (((billingData as any)[k] || 0) !== ((existingData as any)[k] || 0)),
        );

        if (discountTaxChanged) {
          // Best-effort audit log — logging failures must never mask a
          // successful billing update as a failure.
          try {
            const { auditLogService } = await import("./auditLogService");

            await auditLogService.logDiscountTaxChange({
              performedBy: auth.currentUser?.uid || "system",
              clinicId: existingData.clinicId,
              branchId: (existingData as any).branchId,
              billingId: id,
              invoiceNumber: existingData.invoiceNumber,
              before: {
                discountType: (existingData as any).discountType,
                discountValue: (existingData as any).discountValue,
                applyTax: (existingData.taxPercentage || 0) > 0,
                taxPercentage: existingData.taxPercentage,
              },
              after: {
                discountType:
                  "discountType" in billingData
                    ? (billingData as any).discountType
                    : (existingData as any).discountType,
                discountValue:
                  "discountValue" in billingData
                    ? (billingData as any).discountValue
                    : (existingData as any).discountValue,
                applyTax:
                  (("taxPercentage" in billingData
                    ? billingData.taxPercentage
                    : existingData.taxPercentage) || 0) > 0,
                taxPercentage:
                  "taxPercentage" in billingData
                    ? billingData.taxPercentage
                    : existingData.taxPercentage,
              },
            });
          } catch (auditError) {
            console.error("Error logging discount/tax audit event:", auditError);
          }
        }
      }
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
          ...data,
          // Always last: a document's real Firestore doc-id must win over
          // any stray `id` field that ended up stored inside the document
          // itself (see issueCreditNote — spreading `...original` used to
          // carry the original invoice's id into the new document).
          id: billingDoc.id,
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
  ): Promise<PathologyBilling[]> {
    try {
      if (!clinicId) {
        throw new Error("Clinic ID is required");
      }

      const billingRef = collection(db, PATHOLOGY_BILLING_COLLECTION);
      const q = query(billingRef, where("clinicId", "==", clinicId));

      const querySnapshot = await getDocs(q);
      const billings: PathologyBilling[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();

        billings.push({
          ...data,
          // See getBillingById for why this must come after the spread.
          id: doc.id,
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
   * Get all pathology billing records for a specific patient within a clinic.
   * Note: `patientId` is optional on `PathologyBilling` (walk-in/outsider
   * patients have no linked record) — records without it simply won't match.
   */
  async getBillingByPatient(
    patientId: string,
    clinicId: string,
  ): Promise<PathologyBilling[]> {
    try {
      if (!clinicId || !patientId) {
        throw new Error("Clinic ID and Patient ID are required");
      }

      const billingRef = collection(db, PATHOLOGY_BILLING_COLLECTION);
      const q = query(
        billingRef,
        where("clinicId", "==", clinicId),
        where("patientId", "==", patientId),
      );

      const querySnapshot = await getDocs(q);
      const billings: PathologyBilling[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();

        billings.push({
          ...data,
          id: doc.id,
          invoiceDate: data.invoiceDate?.toDate() || new Date(),
          paymentDate: data.paymentDate?.toDate() || null,
          finalizedAt: data.finalizedAt?.toDate() || null,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as PathologyBilling);
      });

      return billings.sort((a, b) => {
        const dateA = a.createdAt?.getTime() || 0;
        const dateB = b.createdAt?.getTime() || 0;

        return dateB - dateA;
      });
    } catch (error) {
      console.error("Error getting pathology billing by patient:", error);
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
   * Cancel an invoice with a mandatory documented reason (IRD clause 6(झ)).
   * If the invoice has a Java-backed ledger entry, that call is blocking and
   * authoritative — a failure there aborts the cancellation rather than
   * leaving Firestore and the Java ledger disagreeing about whether this
   * invoice is still active.
   */
  async cancelBilling(
    id: string,
    reason: string,
  ): Promise<void> {
    const billing = await this.getBillingById(id);

    if (!billing) {
      throw new Error("Invoice not found");
    }

    if ((billing as any).javaInvoiceId) {
      const { billingApi } = await import("./api/billingApi");

      await billingApi.cancelInvoice((billing as any).javaInvoiceId, reason);
    }

    const cancellationNote = `Cancelled on ${new Date().toLocaleDateString()}. Reason: ${reason}`;
    const notes = billing.notes
      ? `${billing.notes}\n${cancellationNote}`
      : cancellationNote;

    await this.updateBilling(id, {
      status: "cancelled",
      paymentStatus: "cancelled" as any,
      notes,
    });

    await reverseCommissionsForBilling(id);
    await refundWalletIfApplicable(billing, cancellationNote, "system");
  },

  /**
   * Issue a Credit Note (Sales Return) for a finalized/synced invoice
   */
  async issueCreditNote(
    originalBillingId: string,
    reason: string,
    createdBy: string,
  ): Promise<string> {
    try {
      const original = await this.getBillingById(originalBillingId);

      if (!original) throw new Error("Original billing record not found");

      if (!original.irdSynced) {
        throw new Error(
          "Can only issue Credit Notes for IRD-synced invoices. For unsynced invoices, simply edit or cancel them.",
        );
      }

      if (original.hasCreditNote) {
        throw new Error("A Credit Note has already been issued for this invoice.");
      }

      // Generate negative items
      const negativeItems = original.items.map((item) => ({
        ...item,
        price: -Math.abs(item.price || 0),
        amount: -Math.abs(item.amount),
      }));

      // Generate invoice number
      const nextInvoiceNumber = await this.generateInvoiceNumber(
        original.clinicId,
      );
      const creditNoteInvoiceNumber = `CN-${nextInvoiceNumber}`;

      // Strip id/createdAt/updatedAt before spreading — `...original` alone
      // would otherwise carry the ORIGINAL invoice's Firestore doc-id into
      // this new document as a plain field, which then silently overrides
      // the credit note's own doc-id everywhere it's read back.
      const { id: _originalId, createdAt: _originalCreatedAt, updatedAt: _originalUpdatedAt, ...originalWithoutId } = original;

      const creditNoteData: Omit<
        PathologyBilling,
        "id" | "createdAt" | "updatedAt"
      > = {
        ...originalWithoutId,
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

      // createBilling already submitted this to the Java backend with
      // isReturn: true (routed to IRD's /api/billreturn) — no separate
      // sync call needed here.
      const newCreditNoteId = await this.createBilling(creditNoteData);

      // Update original invoice to note it has been reversed, and mark it
      // so a second Credit Note can never be issued against it.
      await this.updateBilling(original.id, {
        hasCreditNote: true,
        notes:
          (original.notes ? original.notes + "\n" : "") +
          `Reversed by Credit Note ${creditNoteInvoiceNumber} on ${new Date().toLocaleDateString()}`,
      });

      // The credit note fully offsets the original sale — reverse whatever
      // commission was earned on it (the credit note document itself never
      // earns commission, since finalizeInvoice is never called on it).
      await reverseCommissionsForBilling(original.id);
      await refundWalletIfApplicable(original, reason, createdBy);

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
        console.warn(
          `Attempted to record payment on already paid pathology invoice: ${id}`,
        );
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
    // Delegates to the shared taxEngine.ts (same engine appointments/
    // procedures/prescriptions already use) instead of the bespoke math
    // this used to do — the old version had no taxable/exempt split (taxed
    // the whole post-discount amount unconditionally) and no clamping
    // against negative/over-discount. Every item is marked isTaxable: true
    // to exactly preserve this function's existing "100% of the
    // post-discount amount is taxed" behavior for its current caller.
    const breakdown = calculateTaxBreakdown({
      items: items.map((item) => ({
        id: item.id,
        itemName: item.testName,
        quantity: item.quantity,
        price: item.price,
        discountType: item.discountType,
        discountValue: item.discountValue,
        isTaxable: true,
      })),
      discountType,
      discountValue,
      defaultTaxPercentage: taxPercentage,
      isTaxEnabled: taxPercentage > 0,
    });

    return {
      subtotal: breakdown.subtotal,
      discountAmount: breakdown.totalDiscountAmount,
      taxAmount: breakdown.taxAmount,
      totalAmount: breakdown.totalAmount,
    };
  },
};
