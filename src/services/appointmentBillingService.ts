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
  AppointmentBilling,
  AppointmentBillingSettings,
  AppointmentBillingItem,
  PaymentMethod,
} from "../types/models";
import { calculateTaxBreakdown } from "../utils/taxEngine";

import { patientService } from "./patientService";
import { walletService } from "./walletService";
import { navigationService } from "./navigationService";

const APPOINTMENT_BILLING_COLLECTION = "appointmentBilling";
const APPOINTMENT_BILLING_SETTINGS_COLLECTION = "appointmentBillingSettings";

/**
 * Whether an appointment billing record is IRD-locked — financial and other
 * data may no longer be edited (see `updateBilling`'s compliance guard).
 * Exported so callers that patch an existing invoice (e.g. front-office-desk.tsx)
 * can check this BEFORE attempting an update, instead of relying on a thrown
 * error as control flow.
 */
export function isBillingLocked(
  billing: Pick<AppointmentBilling, "irdSynced" | "status">,
): boolean {
  return Boolean(billing.irdSynced || billing.status === "finalized");
}

/**
 * Reverse every doctor/expert/referral-partner commission tied to a billing
 * (cancelling a commission record and rolling back the clinician/partner's
 * totalCommissionEarned/totalCommissionBalance). Used when an invoice is
 * cancelled or credit-noted so commission earned on a reversed sale doesn't
 * stay permanently on the books. A billing can have multiple commission
 * docs (one per clinician group / one per referrer), so every match is
 * reversed, not just the first. Failures here are logged, not thrown — the
 * invoice-side cancellation/credit-note is the primary, legally-required
 * action and must not be blocked by a commission-bookkeeping error.
 */
async function reverseCommissionsForBilling(billingId: string): Promise<void> {
  try {
    const { doctorCommissionService } = await import(
      "./doctorCommissionService"
    );
    const { expertCommissionService } = await import(
      "./expertCommissionService"
    );
    const { referralCommissionService } = await import(
      "./referralCommissionService"
    );
    const { staffCommissionService } = await import(
      "./staffCommissionService"
    );

    const [docComms, expComms, refComms, staffComms] = await Promise.all([
      doctorCommissionService.getCommissionsByBillingId(billingId),
      expertCommissionService.getCommissionsByBillingId(billingId),
      referralCommissionService.getCommissionsByBillingId(billingId),
      staffCommissionService.getCommissionsByBillingId(billingId),
    ]);

    await Promise.all([
      ...docComms
        .filter((c) => c.status !== "cancelled")
        .map((c) => doctorCommissionService.updateCommissionStatus(c.id, "cancelled")),
      ...expComms
        .filter((c) => c.status !== "cancelled")
        .map((c) => expertCommissionService.updateCommissionStatus(c.id, "cancelled")),
      ...refComms
        .filter((c) => c.status !== "cancelled")
        .map((c) => referralCommissionService.updateCommissionStatus(c.id, "cancelled")),
      ...staffComms
        .filter((c) => c.status !== "cancelled")
        .map((c) => staffCommissionService.updateCommissionStatus(c.id, "cancelled")),
    ]);
  } catch (error) {
    console.error("Error reversing commissions for billing:", billingId, error);
  }
}

/**
 * Refund a wallet-paid invoice's collected amount back to the patient's
 * wallet on cancel/credit-note. Only applies when the invoice was actually
 * paid via wallet (`paymentMethod === "wallet"`) and money was collected.
 * Failures are logged, not thrown — mirrors reverseCommissionsForBilling's
 * tolerance so a wallet-bookkeeping error never blocks the invoice-side
 * cancellation/credit-note itself.
 */
async function refundWalletIfApplicable(
  billing: AppointmentBilling,
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
    console.error("Error refunding wallet payment for billing:", billing.id, error);
  }
}

/**
 * Service for managing appointment billing operations including invoices and settings
 */
export const appointmentBillingService = {
  // =================== APPOINTMENT BILLING SETTINGS ===================

  /**
   * Get appointment billing settings for a clinic
   */
  async getBillingSettings(
    clinicId: string,
  ): Promise<AppointmentBillingSettings | null> {
    try {
      const settingsRef = doc(
        db,
        APPOINTMENT_BILLING_SETTINGS_COLLECTION,
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
        } as AppointmentBillingSettings;

        // Auto-migrate: Force enable for standalone system
        let needsUpdate = false;
        const updates: any = {};

        if (!settings.isActive || !settings.enabledByAdmin) {
          settings.isActive = true;
          settings.enabledByAdmin = true;
          updates.isActive = true;
          updates.enabledByAdmin = true;
          needsUpdate = true;
        }

        if (!Array.isArray(settings.paymentMethods)) {
          const defaultSettings = this.getDefaultBillingSettings(
            clinicId,
            "system",
          );

          settings.paymentMethods = defaultSettings.paymentMethods;
          settings.defaultPaymentMethod = defaultSettings.defaultPaymentMethod;
          updates.paymentMethods = settings.paymentMethods;
          updates.defaultPaymentMethod = settings.defaultPaymentMethod;
          needsUpdate = true;
        }

        if (needsUpdate) {
          updates.updatedAt = Timestamp.now();
          await updateDoc(settingsRef, updates);
        }

        return settings;
      }

      // If document doesn't exist, create it auto-enabled
      const defaultSettings = this.getDefaultBillingSettings(
        clinicId,
        "system",
      );

      await setDoc(settingsRef, {
        ...defaultSettings,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      return defaultSettings;
    } catch (error) {
      console.error("Error getting billing settings:", error);
      throw error;
    }
  },

  /**
   * Create or update appointment billing settings for a clinic
   */
  async updateBillingSettings(
    clinicId: string,
    settings: Partial<AppointmentBillingSettings>,
    updatedBy: string,
  ): Promise<void> {
    try {
      const settingsRef = doc(
        db,
        APPOINTMENT_BILLING_SETTINGS_COLLECTION,
        clinicId,
      );
      const now = Timestamp.now();

      const data = {
        ...settings,
        clinicId,
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
      console.error("Error updating billing settings:", error);
      throw error;
    }
  },

  /**
   * Enable appointment billing for a clinic (super admin only)
   */
  async enableBillingForClinic(
    clinicId: string,
    enabledBy: string,
  ): Promise<void> {
    try {
      const defaultSettings = this.getDefaultBillingSettings(
        clinicId,
        enabledBy,
      );

      defaultSettings.enabledByAdmin = true;
      defaultSettings.isActive = true;

      const settingsRef = doc(
        db,
        APPOINTMENT_BILLING_SETTINGS_COLLECTION,
        clinicId,
      );

      await setDoc(settingsRef, {
        ...defaultSettings,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      // Invalidate navigation cache for all users in this clinic
      // This will force navigation to rebuild with billing menu items
      navigationService.invalidateClinicCache(clinicId);
    } catch (error) {
      console.error("Error enabling billing for clinic:", error);
      throw error;
    }
  },

  /**
   * Disable appointment billing for a clinic (super admin only)
   */
  async disableBillingForClinic(clinicId: string): Promise<void> {
    try {
      const settingsRef = doc(
        db,
        APPOINTMENT_BILLING_SETTINGS_COLLECTION,
        clinicId,
      );

      await updateDoc(settingsRef, {
        enabledByAdmin: false,
        isActive: false,
        updatedAt: Timestamp.now(),
      });

      // Invalidate navigation cache for all users in this clinic
      // This will force navigation to rebuild without billing menu items
      navigationService.invalidateClinicCache(clinicId);
    } catch (error) {
      console.error("Error disabling billing for clinic:", error);
      throw error;
    }
  },

  /**
   * Get default billing settings for new clinics
   */
  getDefaultBillingSettings(
    clinicId: string,
    createdBy: string,
  ): AppointmentBillingSettings {
    return {
      id: clinicId,
      clinicId,
      branchId: "",
      enabledByAdmin: true,
      isActive: true,
      invoicePrefix: "INV",
      nextInvoiceNumber: 1,
      defaultDiscountType: "percent",
      defaultDiscountValue: 0,
      defaultCommission: 0,
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

  /**
   * Deeply cleans an object by removing any properties with undefined values.
   * This is necessary for Firestore which doesn't support undefined values.
   */
  deepClean<T>(obj: T): T {
    if (obj === null || typeof obj !== "object") {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.deepClean(item)) as unknown as T;
    }

    const cleaned: any = {};

    Object.keys(obj).forEach((key) => {
      const value = (obj as any)[key];

      if (value !== undefined) {
        if (value !== null && typeof value === "object") {
          // Keep Date and Timestamp objects as is (don't treat as regular objects)
          if (value instanceof Date || value instanceof Timestamp) {
            cleaned[key] = value;
          } else {
            cleaned[key] = this.deepClean(value);
          }
        } else {
          cleaned[key] = value;
        }
      }
    });

    return cleaned as T;
  },

  /**
   * Generates a unique ID for items
   */
  generateId(): string {
    return crypto.randomUUID();
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
        APPOINTMENT_BILLING_SETTINGS_COLLECTION,
        clinicId,
      );

      const invoiceNumber = await runTransaction(db, async (transaction) => {
        const settingsDoc = await transaction.get(settingsRef);

        if (!settingsDoc.exists()) {
          throw new Error("Billing settings not found for clinic");
        }

        const settings = settingsDoc.data() as AppointmentBillingSettings;

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

        // Update settings in transaction
        transaction.update(settingsRef, updates);

        return generatedInvoiceNumber;
      });

      return invoiceNumber;
    } catch (error) {
      console.error("Error generating invoice number:", error);
      throw error;
    }
  },

  /**
   * Create a new appointment billing record.
   *
   * The Java backend + MySQL is the authoritative invoice ledger and IRD sync
   * point: it is called FIRST and BLOCKING, and its response's invoiceNumber
   * is what actually gets persisted here — any invoiceNumber the caller set
   * on billingData is ignored. A Java backend failure throws (surfaced to the
   * caller) rather than silently creating a Firestore-only invoice with no
   * real ledger entry and no invoice number that will ever reach IRD.
   *
   * Returns the authoritative invoiceNumber alongside the Firestore id —
   * callers must use the returned invoiceNumber (not a pre-generated one)
   * for anything shown to the patient (receipts, print, confirmation UI).
   */
  async createBilling(
    billingData: Omit<AppointmentBilling, "id" | "createdAt" | "updatedAt">,
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

    const taxPercentage = billingData.taxPercentage || 0;
    const isCreditNote = Boolean((billingData as any).isCreditNote);

    // calculateTaxBreakdown() is the shared engine for a normal sale — it
    // clamps unit prices to >= 0 (Math.max(0, item.price)), which is correct
    // for a regular invoice but silently zeroes out an entire Credit Note's
    // totals, since a credit note's items carry negative prices by design.
    // issueCreditNote() already computed the correct negative
    // subtotal/tax/total on billingData itself — trust those directly for a
    // credit note instead of recomputing (and zeroing) them here.
    const calc = isCreditNote
      ? {
          totalAmount: billingData.totalAmount || 0,
          taxableAmount:
            (billingData.subtotal || 0) - (billingData.discountAmount || 0),
          taxAmount: billingData.taxAmount || 0,
          exemptAmount: 0,
          totalDiscountAmount: billingData.discountAmount || 0,
        }
      : calculateTaxBreakdown({
          items: (billingData.items || []).map((i) => ({
            itemName: i.appointmentTypeName || "Service",
            quantity: i.quantity,
            price: i.price,
            discountType: i.discountType,
            discountValue: i.discountValue,
            isTaxable:
              i.isTaxable !== undefined ? i.isTaxable : taxPercentage > 0,
            taxRate: taxPercentage,
          })),
          discountType: billingData.discountType || "flat",
          discountValue: billingData.discountValue || 0,
          defaultTaxPercentage: taxPercentage,
          isTaxEnabled: taxPercentage > 0,
        });

    // IRD's irdEnabled/credentials live on the Clinic document (that's what
    // Clinic Settings > IRD CBMS Configuration actually writes to) — never
    // on ClinicSettings, which has its own same-named but always-unset field.
    const clinic = await clinicService.getClinicById(billingData.clinicId);

    const invoiceItems = (billingData.items || []).map((item) => ({
      itemName: item.appointmentTypeName || "Service",
      quantity: item.quantity || 1,
      rate: item.price || 0,
      totalAmount: item.amount || 0,
      isTaxable:
        item.isTaxable !== undefined ? item.isTaxable : taxPercentage > 0,
    }));

    // Only intent (irdEnabled) travels to the Java backend — actual IRD
    // credentials are resolved server-side per clinic, never sent from here.
    const invoicePayload = {
      firebasePatientId: billingData.patientId || "",
      buyerName: billingData.patientName || "Cash Sales",
      buyerPan: billingData.patientPanVat || "",
      totalAmount: calc.totalAmount,
      taxableAmount: calc.taxableAmount,
      taxAmount: calc.taxAmount,
      exemptAmount: calc.exemptAmount,
      discountAmount: calc.totalDiscountAmount,
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
        totalAmount: calc.totalAmount,
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
      const billingRef = collection(db, APPOINTMENT_BILLING_COLLECTION);
      const cleanedData = this.deepClean(billingData);

      const data = {
        ...cleanedData,
        invoiceNumber: javaResult.invoiceNumber,
        invoiceDate: billingData.invoiceDate
          ? Timestamp.fromDate(billingData.invoiceDate)
          : Timestamp.now(),
        javaInvoiceId: javaResult.id,
        irdSynced: Boolean(javaResult.irdSynced),
        irdSyncDate: javaResult.irdSyncDate
          ? new Date(javaResult.irdSyncDate)
          : null,
        cbmsResponseCode: javaResult.cbmsResponseCode || null,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      const docRef = await addDoc(billingRef, data);

      console.log(
        "Appointment billing created in Firestore with ID:",
        docRef.id,
        "invoiceNumber:",
        javaResult.invoiceNumber,
      );

      if (!isCreditNote) {
        // Best-effort audit log — logging failures must never mask a
        // successful invoice creation as a save failure.
        try {
          const { auditLogService } = await import("./auditLogService");

          await auditLogService.logDiscountTaxChange({
            performedBy: auth.currentUser?.uid || "system",
            clinicId: billingData.clinicId,
            branchId: billingData.branchId,
            billingId: docRef.id,
            invoiceNumber: javaResult.invoiceNumber,
            after: {
              discountType: billingData.discountType,
              discountValue: billingData.discountValue,
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
      console.error("Error creating appointment billing:", error);
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
   * Update an existing appointment billing record
   */
  async updateBilling(
    id: string,
    billingData: Partial<AppointmentBilling>,
  ): Promise<void> {
    try {
      const existing = await this.getBillingById(id);
      let isAlteringFinancials = false;

      if (existing) {
        const financialKeys = [
          "totalAmount",
          "subtotal",
          "taxAmount",
          "discountAmount",
          "mainDiscountAmount",
        ];
        // undefined/null normalized to 0 — otherwise re-sending an
        // unchanged-but-previously-unset field (e.g. discountAmount: 0 when
        // the existing record has it as undefined) reads as a "change" and
        // wrongly blocks a legitimate, purely non-financial update like
        // recording a payment.
        const simpleValuesChanged = financialKeys.some((k) => {
          if (k in billingData) {
            return ((billingData as any)[k] || 0) !== ((existing as any)[k] || 0);
          }

          return false;
        });

        const itemsChanged =
          "items" in billingData &&
          JSON.stringify(billingData.items) !== JSON.stringify(existing.items);

        isAlteringFinancials = simpleValuesChanged || itemsChanged;

        const isFinalized = isBillingLocked(existing);

        if (isAlteringFinancials && isFinalized) {
          throw new Error(
            "IRD Tax Compliance Error: Financial fields of finalized or IRD-synced invoices cannot be modified. Issue a Credit Note instead.",
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
            "previousDuePaidAmount",
            "printCount",
            "irdSynced",
            "irdSyncDate",
            "cbmsResponseCode",
            "status",
            "hasCreditNote",
            "finalizedBy",
            "finalizedAt",
          ]);

          for (const key of Object.keys(billingData)) {
            if (financialKeys.includes(key) || key === "items") continue;
            if (allowedPostFinalizeFields.has(key)) continue;

            if (key === "notes") {
              const oldNotes = existing.notes || "";
              const newNotes = (billingData as any).notes || "";

              if (newNotes === oldNotes || newNotes.startsWith(oldNotes)) continue;

              throw new Error(
                "IRD Tax Compliance Error: Notes on a finalized or IRD-synced invoice can only be appended to (e.g. cancellation/credit-note remarks), not rewritten.",
              );
            }

            const oldVal = (existing as any)[key];
            const newVal = (billingData as any)[key];
            const changed =
              typeof newVal === "object" && newVal !== null
                ? JSON.stringify(newVal) !== JSON.stringify(oldVal)
                : newVal !== oldVal;

            if (changed) {
              throw new Error(
                "IRD Tax Compliance Error: Data of a finalized or IRD-synced invoice cannot be modified. Issue a Credit Note instead.",
              );
            }
          }
        }
      }

      const billingRef = doc(db, APPOINTMENT_BILLING_COLLECTION, id);

      // Filter out undefined values to prevent Firestore errors
      const cleanedData = this.deepClean(billingData);

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
      console.log("Appointment billing updated:", id);

      if (existing) {
        const discountTaxKeys = ["discountType", "discountValue", "taxPercentage"];
        const discountTaxChanged = discountTaxKeys.some(
          (k) =>
            k in billingData &&
            ((billingData as any)[k] || 0) !== ((existing as any)[k] || 0),
        );

        if (discountTaxChanged) {
          // Best-effort audit log — logging failures must never mask a
          // successful billing update as a failure.
          try {
            const { auditLogService } = await import("./auditLogService");

            await auditLogService.logDiscountTaxChange({
              performedBy: auth.currentUser?.uid || "system",
              clinicId: existing.clinicId,
              branchId: existing.branchId,
              billingId: id,
              invoiceNumber: existing.invoiceNumber,
              before: {
                discountType: existing.discountType,
                discountValue: existing.discountValue,
                applyTax: (existing.taxPercentage || 0) > 0,
                taxPercentage: existing.taxPercentage,
              },
              after: {
                discountType:
                  "discountType" in billingData
                    ? billingData.discountType
                    : existing.discountType,
                discountValue:
                  "discountValue" in billingData
                    ? billingData.discountValue
                    : existing.discountValue,
                applyTax:
                  (("taxPercentage" in billingData
                    ? billingData.taxPercentage
                    : existing.taxPercentage) || 0) > 0,
                taxPercentage:
                  "taxPercentage" in billingData
                    ? billingData.taxPercentage
                    : existing.taxPercentage,
              },
            });
          } catch (auditError) {
            console.error("Error logging discount/tax audit event:", auditError);
          }
        }
      }
    } catch (error) {
      console.error("Error updating appointment billing:", error);
      throw error;
    }
  },

  /**
   * Get appointment billing by ID
   */
  async getBillingById(id: string): Promise<AppointmentBilling | null> {
    try {
      const billingRef = doc(db, APPOINTMENT_BILLING_COLLECTION, id);
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
        } as AppointmentBilling;
      }

      return null;
    } catch (error) {
      console.error("Error getting appointment billing:", error);
      throw error;
    }
  },

  /**
   * Get all appointment billing records for a clinic.
   */
  async getBillingByClinic(
    clinicId: string,
  ): Promise<AppointmentBilling[]> {
    try {
      if (!clinicId) {
        console.error("No clinicId provided to getBillingByClinic");

        return [];
      }

      const currentUser = auth.currentUser;

      console.log(
        "Fetching billing records for clinic:",
        clinicId,
        "User:",
        currentUser?.uid,
      );

      const billingRef = collection(db, APPOINTMENT_BILLING_COLLECTION);

      const constraints: any[] = [where("clinicId", "==", clinicId)];

      const q = query(billingRef, ...constraints);

      const querySnapshot = await getDocs(q);
      const billingRecords: AppointmentBilling[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();

        billingRecords.push({
          ...data,
          // See getBillingById for why this must come after the spread.
          id: doc.id,
          invoiceDate: data.invoiceDate?.toDate() || new Date(),
          paymentDate: data.paymentDate?.toDate() || null,
          finalizedAt: data.finalizedAt?.toDate() || null,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as AppointmentBilling);
      });

      // Sort in memory by creation date (newest first)
      billingRecords.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      );

      console.log(
        "Successfully fetched",
        billingRecords.length,
        "billing records",
      );

      return billingRecords;
    } catch (error) {
      console.error("Error getting billing records by clinic:", error);

      // Enhanced error logging
      if (error instanceof Error) {
        console.error("Error details:", {
          message: error.message,
          clinicId,
          userId: auth.currentUser?.uid || "not authenticated",
          userEmail: auth.currentUser?.email || "no email",
        });

        // Check if it's a permission error
        if (error.message.includes("Missing or insufficient permissions")) {
          console.error(
            "Permission denied - check Firestore rules and user authentication",
          );
          console.error("Current user clinicId:", auth.currentUser?.uid);
        }
      }

      // Return empty array instead of throwing to prevent complete page failure
      return [];
    }
  },

  /**
   * Get appointment billing records for a patient
   */
  async getBillingByPatient(
    patientId: string,
    clinicId: string,
  ): Promise<AppointmentBilling[]> {
    try {
      const billingRef = collection(db, APPOINTMENT_BILLING_COLLECTION);
      const q = query(billingRef, where("patientId", "==", patientId));

      const querySnapshot = await getDocs(q);
      const billingRecords: AppointmentBilling[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();

        billingRecords.push({
          ...data,
          // See getBillingById for why this must come after the spread.
          id: doc.id,
          invoiceDate: data.invoiceDate?.toDate() || new Date(),
          paymentDate: data.paymentDate?.toDate() || null,
          finalizedAt: data.finalizedAt?.toDate() || null,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as AppointmentBilling);
      });

      // Sort in-memory to avoid index requirement
      return billingRecords.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      );
    } catch (error) {
      console.error("Error getting billing records by patient:", error);
      throw error;
    }
  },

  /**
   * Finalize an invoice (change status from draft to finalized)
   */
  async finalizeInvoice(id: string, finalizedBy: string): Promise<void> {
    try {
      await this.updateBilling(id, {
        status: "finalized",
        finalizedBy,
        finalizedAt: new Date(), // Note: IRD Sync is now handled by the Java Backend upon creation.
      });
    } catch (error) {
      console.error("Error finalizing invoice:", error);
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
    discountAmount: number = 0,
  ): Promise<void> {
    try {
      const billing = await this.getBillingById(id);

      if (!billing) {
        throw new Error("Billing record not found");
      }

      if (billing.paymentStatus === "paid" && paymentAmount > 0) {
        console.warn(
          `Attempted to record payment on already paid invoice: ${id}`,
        );
        throw new Error("This invoice is already fully paid.");
      }

      // Handle discount
      const newTotalAmount = Math.max(0, billing.totalAmount - discountAmount);
      const newMainDiscountAmount =
        (billing.mainDiscountAmount || 0) + discountAmount;
      const newTotalDiscountAmount =
        (billing.discountAmount || 0) + discountAmount;

      const newPaidAmount = billing.paidAmount + paymentAmount;
      const newBalanceAmount = Math.max(0, newTotalAmount - newPaidAmount);

      let paymentStatus: "unpaid" | "partial" | "paid" = "unpaid";

      if (newPaidAmount >= newTotalAmount) {
        paymentStatus = "paid";
      } else if (newPaidAmount > 0) {
        paymentStatus = "partial";
      }

      // If paying via wallet, verify balance and deduct funds
      if (paymentMethod === "wallet") {
        const patient = await patientService.getPatientById(billing.patientId);

        if (!patient || (patient.walletBalance || 0) < paymentAmount) {
          throw new Error("Insufficient wallet balance");
        }
        await walletService.deductFunds(
          billing.patientId,
          billing.clinicId,
          paymentAmount,
          id,
          paymentNotes || `Paid Invoice ${billing.invoiceNumber || "Draft"}`,
          auth.currentUser?.uid || "system",
        );
      }

      // Prepare update data, only including non-empty optional fields
      const updateData: Partial<AppointmentBilling> = {
        totalAmount: newTotalAmount,
        mainDiscountAmount: newMainDiscountAmount,
        discountAmount: newTotalDiscountAmount,
        paidAmount: newPaidAmount,
        balanceAmount: newBalanceAmount,
        paymentStatus,
        paymentMethod,
        paymentDate: new Date(),
      };

      const newPaymentEvent: any = {
        id: crypto.randomUUID(),
        amount: paymentAmount,
        method: paymentMethod,
        date: new Date(),
        recordedBy: auth.currentUser?.uid || "system",
      };

      if (paymentReference && paymentReference.trim() !== "") {
        newPaymentEvent.reference = paymentReference.trim();
        updateData.paymentReference = paymentReference.trim();
      }

      // Only include paymentNotes if it's not empty
      if (paymentNotes && paymentNotes.trim() !== "") {
        newPaymentEvent.notes = paymentNotes.trim();
        updateData.paymentNotes = paymentNotes.trim();
      }

      updateData.paymentHistory = [
        ...(billing.paymentHistory || []),
        newPaymentEvent,
      ];

      await this.updateBilling(id, updateData);

      // Also find and update the associated appointment in the appointments collection
      try {
        const appointmentsRef = collection(db, "appointments");
        // 1. Try finding by billingId
        let q = query(appointmentsRef, where("billingId", "==", id));
        let querySnapshot = await getDocs(q);

        // 1.5. Try finding by consultationBillingId
        if (querySnapshot.empty) {
          q = query(appointmentsRef, where("consultationBillingId", "==", id));
          querySnapshot = await getDocs(q);
        }

        // 2. Fallback: if not found by billingId or consultationBillingId (legacy/external creation), try patientId & status = completed
        if (querySnapshot.empty) {
          q = query(
            appointmentsRef,
            where("patientId", "==", billing.patientId),
            where("status", "==", "completed"),
          );
          querySnapshot = await getDocs(q);
        }

        if (!querySnapshot.empty) {
          const isConsultationOnly =
            billing.items &&
            billing.items.some(
              (item: any) =>
                item.appointmentTypeId === "consultation-fee" ||
                (item.appointmentTypeName &&
                  item.appointmentTypeName.includes("Consultation Fee")),
            );

          const updatePromises = querySnapshot.docs.map((docSnap) => {
            const apptDocRef = doc(db, "appointments", docSnap.id);
            const apptData = docSnap.data();
            const apptUpdates: any = {
              billingStatus: paymentStatus,
              paymentStatus: paymentStatus,
              consultationBillingStatus: paymentStatus,
              updatedAt: Timestamp.now(),
            };

            return updateDoc(apptDocRef, apptUpdates);
          });

          await Promise.all(updatePromises);
          console.log(
            `Updated associated appointments for billing ID ${id} to billingStatus: ${paymentStatus}`,
          );
        }
      } catch (apptError) {
        console.error(
          "Error updating associated appointment status:",
          apptError,
        );
      }

      // Auto-create follow-up and commissions if fully paid
      if (paymentStatus === "paid" && billing.paymentStatus !== "paid") {
        // 1. Follow-up Logic
        if (billing.patientId) {
          try {
            const { followupService } = await import("./followupService");
            const { patientService } = await import("./patientService");

            const patient = await patientService.getPatientById(
              billing.patientId,
            );

            if (patient) {
              const services = billing.items
                .map((item) => item.appointmentTypeName)
                .join(" | ");

              await followupService.createFollowup({
                clinicId: billing.clinicId,
                branchId: billing.branchId || "",
                category: "appointment",
                patientId: billing.patientId,
                patientName: patient.name,
                patientMobile: patient.mobile || patient.phone || "",
                appointmentId: id, // using billing id as reference
                visitDate: new Date(),
                session: "1st",
                initStatus: "good",
                overallStatus: "pending",
                service: services,
                createdBy: auth.currentUser?.uid || "system",
              } as any);
              console.log("Auto-created appointment followup for billing", id);
            }
          } catch (e) {
            console.error("Failed to auto-create followup:", e);
          }
        }

        // 2. Commission Logic
        try {
          const { doctorService } = await import("./doctorService");
          const { expertService } = await import("./expertService");
          const { doctorCommissionService } = await import(
            "./doctorCommissionService"
          );
          const { expertCommissionService } = await import(
            "./expertCommissionService"
          );
          const { referralCommissionService } = await import(
            "./referralCommissionService"
          );
          const { staffCommissionService } = await import(
            "./staffCommissionService"
          );

          // We need ALL doctors and experts for this clinic to determine types and default commissions
          const doctors = await doctorService.getDoctorsByClinic(
            billing.clinicId,
          );
          const experts = await expertService.getExpertsByClinic(
            billing.clinicId,
          );

          const clinicianMap = new Map<
            string,
            { isExpert: boolean; items: typeof billing.items }
          >();

          for (const item of billing.items) {
            const cId = item.doctorId || billing.doctorId;

            if (!cId) continue;

            const clinician =
              doctors.find((d) => d.id === cId) ||
              experts.find((e) => e.id === cId);
            const sanitizedItem = {
              ...item,
              doctorId: cId, // FORCE explicit assignment to prevent fallback
              doctorName:
                clinician?.name || item.doctorName || billing.doctorName,
              commission:
                typeof item.commission === "number"
                  ? item.commission
                  : parseFloat(item.commission as any) || 0,
              amount:
                typeof item.amount === "number"
                  ? item.amount
                  : parseFloat(item.amount as any) || 0,
            };

            if (!clinicianMap.has(cId)) {
              const isExpert =
                experts.some((e) => e.id === cId) &&
                !doctors.some((d) => d.id === cId);

              clinicianMap.set(cId, { isExpert, items: [] });
            }
            clinicianMap.get(cId)!.items.push(sanitizedItem);
          }

          const currentUserId = auth.currentUser?.uid || "system";

          // Create commissions for each clinician
          for (const [cId, group] of clinicianMap.entries()) {
            const clinician =
              doctors.find((d) => d.id === cId) ||
              experts.find((e) => e.id === cId);
            const defaultPct = clinician?.defaultCommission || 0;
            const billingForClinician = {
              ...billing,
              items: group.items,
            };

            console.log(
              `[Commission] clinicianId=${cId} isExpert=${group.isExpert} items=${group.items.length} defaultPct=${defaultPct}`,
            );
            if (group.isExpert) {
              await expertCommissionService.createCommissionsFromBilling(
                billingForClinician,
                defaultPct,
                currentUserId,
              );
            } else {
              await doctorCommissionService.createCommission(
                billingForClinician,
                defaultPct,
                currentUserId,
              );
            }
          }

          // Log Polymorphic Referrer Commissions
          const processedReferrals = billing.referrals || [];

          for (const r of processedReferrals) {
            if (r.commissionAmount <= 0) continue;

            if (r.type === "referral-partner") {
              await referralCommissionService.createReferralCommission(
                billing,
                r as any,
                r.commissionAmount,
                currentUserId,
              );
            } else if (r.type === "doctor") {
              // Prevent double-commission by removing items native to the referrer
              const itemsForReferral = billing.items.filter(
                (item: any) => item.doctorId !== r.id,
              );

              if (itemsForReferral.length > 0) {
                const referralBillingData = {
                  ...billing,
                  doctorId: r.id,
                  doctorName: r.name,
                  items: itemsForReferral.map((i: any) => ({
                    ...i,
                    doctorId: undefined,
                    doctorName: undefined,
                    commission: undefined,
                  })),
                };

                await doctorCommissionService.createCommission(
                  referralBillingData,
                  r.commissionPercentage,
                  currentUserId,
                );
              }
            } else if (r.type === "expert") {
              await expertCommissionService.createCommission(
                r.id,
                r.name,
                billing,
                r.commissionPercentage,
                currentUserId,
              );
            } else if (r.type === "staff") {
              await staffCommissionService.createRegistrationCommission(
                r.id,
                r.name,
                billing.clinicId,
                billing.patientId || "",
                billing.patientName,
                "Invoice Payment - Staff Referral",
                billing.totalAmount,
                r.commissionAmount,
                r.commissionPercentage,
                currentUserId,
              );
            }
          }
        } catch (err) {
          console.error(
            "Error generating commissions inside recordPayment:",
            err,
          );
        }

        // 3. IRD Sync Logic
        try {
          const { clinicSettingsService } = await import(
            "./clinicSettingsService"
          );
          const { clinicService } = await import("./clinicService");
          const { getNepaliFiscalYear } = await import("./irdCbmsService");

          const clinicSettings = await clinicSettingsService.getClinicSettings(
            billing.clinicId,
          );
          const clinic = await clinicService.getClinicById(billing.clinicId);

          if (clinicSettings && clinic && clinic.irdEnabled) {
            if (billing.javaInvoiceId) {
              // Java-backed invoice: re-sync through the Java backend so
              // credentials stay server-side and irdSynced/cbmsResponseCode
              // are only ever set from a Java-verified result, never
              // fabricated from a client-driven legacy sync.
              const { billingApi } = await import("./api/billingApi");
              const javaResult = await billingApi.retryIrdSync(
                billing.javaInvoiceId,
                {
                  fiscalYear: getNepaliFiscalYear(billing.invoiceDate),
                  isReturn: false,
                },
              );

              await this.updateBilling(id, {
                irdSynced: javaResult.irdSynced,
                irdSyncDate: new Date(),
                cbmsResponseCode: javaResult.cbmsResponseCode,
              });
            } else {
              // Legacy pre-Java-migration invoice — fall back to the
              // Firebase-proxied sync path.
              const { syncInvoiceToIRD } = await import("./irdCbmsService");
              const result = await syncInvoiceToIRD({
                clinicSettings,
                clinic,
                invoiceData: {
                  buyerName: billing.patientName || "Cash Sales",
                  buyerPan: billing.patientPanVat || "",
                  invoiceNumber: billing.invoiceNumber,
                  invoiceDate: billing.invoiceDate,
                  totalAmount: newTotalAmount,
                  taxAmount: billing.taxAmount || 0,
                  isTaxEnabled: billing.taxPercentage > 0,
                },
              });

              await this.updateBilling(id, {
                irdSynced: result.success,
                irdSyncDate: new Date(),
                cbmsResponseCode: result.responseCode,
              });
            }
          }
        } catch (irdError) {
          console.error(
            "Failed to sync invoice to IRD inside recordPayment:",
            irdError,
          );
        }

        // 4. Audit Log Payment Event
        try {
          const { auditLogService } = await import("./auditLogService");

          await auditLogService.logPayment({
            performedBy: auth.currentUser?.uid || "system",
            performedByName: auth.currentUser?.displayName || "Staff Cashier",
            performedByEmail: auth.currentUser?.email || "",
            clinicId: billing.clinicId,
            branchId: billing.branchId,
            invoiceNumber: billing.invoiceNumber,
            amountPaid: paymentAmount,
            paymentMethod,
            patientName: billing.patientName,
          });
        } catch (auditErr) {
          console.warn("Failed to record payment audit log:", auditErr);
        }
      }
    } catch (error) {
      console.error("Error recording payment:", error);
      throw error;
    }
  },

  // =================== UTILITY FUNCTIONS ===================

  /**
   * Calculate invoice totals from items
   */
  calculateInvoiceTotals(
    items: AppointmentBillingItem[],
    discountType: "flat" | "percent",
    discountValue: number,
    taxPercentage: number,
  ): {
    subtotal: number;
    itemDiscountAmount: number;
    mainDiscountAmount: number;
    totalDiscount: number;
    taxAmount: number;
    totalAmount: number;
    taxableAmount: number;
    exemptAmount: number;
  } {
    const calc = calculateTaxBreakdown({
      items: items.map((i) => ({
        itemName: i.appointmentTypeName || "Service",
        quantity: i.quantity,
        price: i.price,
        discountType: i.discountType,
        discountValue: i.discountValue,
        isTaxable: i.isTaxable !== undefined ? i.isTaxable : taxPercentage > 0,
        taxRate: taxPercentage,
      })),
      discountType,
      discountValue,
      defaultTaxPercentage: taxPercentage,
      isTaxEnabled: taxPercentage > 0,
    });

    return {
      subtotal: calc.subtotal,
      itemDiscountAmount: calc.itemDiscountAmount,
      mainDiscountAmount: calc.mainDiscountAmount,
      totalDiscount: calc.totalDiscountAmount,
      taxAmount: calc.taxAmount,
      totalAmount: calc.totalAmount,
      taxableAmount: calc.taxableAmount,
      exemptAmount: calc.exemptAmount,
    };
  },

  /**
   * Check if billing is enabled for a clinic
   */
  async isBillingEnabled(clinicId: string): Promise<boolean> {
    try {
      const settings = await this.getBillingSettings(clinicId);

      return settings ? settings.enabledByAdmin && settings.isActive : false;
    } catch (error) {
      console.error("Error checking billing status:", error);

      return false;
    }
  },

  // =================== PAYMENT METHODS MANAGEMENT ===================

  /**
   * Add a new payment method to the clinic's billing settings
   */
  async addPaymentMethod(
    clinicId: string,
    paymentMethod: Omit<PaymentMethod, "id" | "createdAt" | "updatedAt">,
    updatedBy: string,
  ): Promise<void> {
    try {
      const settings = await this.getBillingSettings(clinicId);

      if (!settings) {
        throw new Error("Billing settings not found for clinic");
      }

      const newPaymentMethod: PaymentMethod = {
        id: crypto.randomUUID(),
        ...paymentMethod,
        isCustom: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        updatedBy,
      };

      // Initialize paymentMethods if it doesn't exist or is not an array
      const currentPaymentMethods = Array.isArray(settings.paymentMethods)
        ? settings.paymentMethods
        : this.getDefaultBillingSettings(clinicId, updatedBy).paymentMethods;

      const updatedPaymentMethods = [
        ...currentPaymentMethods,
        newPaymentMethod,
      ];

      await this.updateBillingSettings(
        clinicId,
        {
          paymentMethods: updatedPaymentMethods,
        },
        updatedBy,
      );
    } catch (error) {
      console.error("Error adding payment method:", error);
      throw error;
    }
  },

  /**
   * Update an existing payment method in the clinic's billing settings
   */
  async updatePaymentMethod(
    clinicId: string,
    paymentMethodId: string,
    updates: Partial<Omit<PaymentMethod, "id" | "createdAt" | "isCustom">>,
    updatedBy: string,
  ): Promise<void> {
    try {
      const settings = await this.getBillingSettings(clinicId);

      if (!settings) {
        throw new Error("Billing settings not found for clinic");
      }

      // Initialize paymentMethods if it doesn't exist or is not an array
      const currentPaymentMethods = Array.isArray(settings.paymentMethods)
        ? settings.paymentMethods
        : this.getDefaultBillingSettings(clinicId, updatedBy).paymentMethods;

      const updatedPaymentMethods = currentPaymentMethods.map((method) => {
        if (method.id === paymentMethodId) {
          return {
            ...method,
            ...updates,
            updatedAt: new Date(),
            updatedBy,
          };
        }

        return method;
      });

      await this.updateBillingSettings(
        clinicId,
        {
          paymentMethods: updatedPaymentMethods,
        },
        updatedBy,
      );
    } catch (error) {
      console.error("Error updating payment method:", error);
      throw error;
    }
  },

  /**
   * Delete a payment method from the clinic's billing settings
   */
  async deletePaymentMethod(
    clinicId: string,
    paymentMethodId: string,
    updatedBy: string,
  ): Promise<void> {
    try {
      const settings = await this.getBillingSettings(clinicId);

      if (!settings) {
        throw new Error("Billing settings not found for clinic");
      }

      // Initialize paymentMethods if it doesn't exist or is not an array
      const currentPaymentMethods = Array.isArray(settings.paymentMethods)
        ? settings.paymentMethods
        : this.getDefaultBillingSettings(clinicId, updatedBy).paymentMethods;

      const methodToDelete = currentPaymentMethods.find(
        (method) => method.id === paymentMethodId,
      );

      if (!methodToDelete) {
        throw new Error("Payment method not found");
      }

      // Prevent deletion of non-custom methods (system defaults)
      if (!methodToDelete.isCustom) {
        throw new Error(
          "Cannot delete system default payment methods. You can disable them instead.",
        );
      }

      const updatedPaymentMethods = currentPaymentMethods.filter(
        (method) => method.id !== paymentMethodId,
      );

      // If the deleted method was the default, set the first enabled method as default
      let newDefaultPaymentMethod = settings.defaultPaymentMethod;

      if (settings.defaultPaymentMethod === methodToDelete.key) {
        const firstEnabledMethod = updatedPaymentMethods.find(
          (method) => method.isEnabled,
        );

        newDefaultPaymentMethod = firstEnabledMethod
          ? firstEnabledMethod.key
          : "cash";
      }

      await this.updateBillingSettings(
        clinicId,
        {
          paymentMethods: updatedPaymentMethods,
          defaultPaymentMethod: newDefaultPaymentMethod,
        },
        updatedBy,
      );
    } catch (error) {
      console.error("Error deleting payment method:", error);
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
  async cancelBilling(id: string, reason: string): Promise<void> {
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
        throw new Error("Can only issue Credit Notes for IRD-synced invoices.");
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
        AppointmentBilling,
        "id" | "createdAt" | "updatedAt"
      > = {
        ...originalWithoutId,
        invoiceNumber: creditNoteInvoiceNumber,
        invoiceDate: new Date(),
        items: negativeItems,

        // Reverse amounts
        subtotal: -Math.abs(original.subtotal),
        itemDiscountAmount: -Math.abs(original.itemDiscountAmount || 0),
        mainDiscountAmount: -Math.abs(original.mainDiscountAmount || 0),
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
      // earns commission, since it's created via createBilling, not
      // recordPayment).
      await reverseCommissionsForBilling(original.id);
      await refundWalletIfApplicable(original, reason, createdBy);

      return newCreditNoteId;
    } catch (error) {
      console.error("Error issuing credit note:", error);
      throw error;
    }
  },

  /**
   * Get enabled payment methods for a clinic
   */
  async getEnabledPaymentMethods(clinicId: string): Promise<PaymentMethod[]> {
    try {
      const settings = await this.getBillingSettings(clinicId);

      if (!settings) {
        return [];
      }

      // Initialize paymentMethods if it doesn't exist or is not an array
      const currentPaymentMethods = Array.isArray(settings.paymentMethods)
        ? settings.paymentMethods
        : [];

      return currentPaymentMethods.filter((method) => method.isEnabled);
    } catch (error) {
      console.error("Error getting enabled payment methods:", error);

      return [];
    }
  },
};
