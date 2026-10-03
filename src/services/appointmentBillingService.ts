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
  AppointmentType,
  PaymentMethod,
} from "../types/models";
import { calculateTaxBreakdown } from "../utils/taxEngine";

import { patientService } from "./patientService";
import { walletService } from "./walletService";
import { navigationService } from "./navigationService";
import {
  isRecordLocked,
  assertFinancialFieldsUnlocked,
  assertOnline,
  resolveInvoicePrefix,
  javaResultSyncFields,
  runBlockingJavaSyncThenFirestoreWrite,
  buildCreditNoteSkeleton,
} from "./core/billingLifecycleCore";

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
  return isRecordLocked(billing);
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
export async function reverseCommissionsForBilling(
  billingId: string,
  // Fraction of each commission to claw back — 1 (default) fully cancels
  // the commission, matching a full cancel/credit-note. A value < 1 (e.g.
  // a package refund for N of T unused sessions) only reduces each
  // commission proportionally instead, leaving the clinician's earnings
  // for the portion of service already delivered intact.
  reversalRatio: number = 1,
): Promise<void> {
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

    const ratio = Math.min(1, Math.max(0, reversalRatio));

    if (ratio >= 1) {
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
    } else {
      await Promise.all([
        ...docComms
          .filter((c) => c.status !== "cancelled")
          .map((c) =>
            doctorCommissionService.reduceCommissionAmount(
              c.id,
              c.commissionAmount * ratio,
            ),
          ),
        ...expComms
          .filter((c) => c.status !== "cancelled")
          .map((c) =>
            expertCommissionService.reduceCommissionAmount(
              c.id,
              c.commissionAmount * ratio,
            ),
          ),
        ...refComms
          .filter((c) => c.status !== "cancelled")
          .map((c) =>
            referralCommissionService.reduceCommissionAmount(
              c.id,
              c.commissionAmount * ratio,
            ),
          ),
        ...staffComms
          .filter((c) => c.status !== "cancelled")
          .map((c) =>
            staffCommissionService.reduceCommissionAmount(
              c.id,
              c.commissionAmount * ratio,
            ),
          ),
      ]);
    }
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
      // A bad value here silently reaches every future invoice's tax/
      // commission calculation, including ones synced to IRD — reject
      // out-of-range values instead of writing them.
      if (
        settings.defaultTaxPercentage !== undefined &&
        (settings.defaultTaxPercentage < 0 || settings.defaultTaxPercentage > 100)
      ) {
        throw new Error("Default tax percentage must be between 0 and 100.");
      }
      if (
        settings.defaultCommission !== undefined &&
        (settings.defaultCommission < 0 || settings.defaultCommission > 100)
      ) {
        throw new Error("Default commission percentage must be between 0 and 100.");
      }
      if (
        settings.defaultDiscountValue !== undefined &&
        settings.defaultDiscountValue < 0
      ) {
        throw new Error("Default discount value cannot be negative.");
      }

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
    assertOnline();

    const { billingApi, buildInvoicePayload } = await import(
      "./api/billingApi"
    );
    const { clinicService } = await import("./clinicService");
    const { getNepaliFiscalYear } = await import("./irdCbmsService");

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
            // An item with no explicit isTaxable of its own must default to
            // NOT taxable — this used to fall back to "taxable whenever the
            // invoice-level Apply Tax toggle is on", which silently taxed
            // every category that had never been re-saved since the
            // per-category Taxable setting was introduced (isTaxable still
            // `undefined` in Firestore even though its settings modal shows
            // "Taxable" unchecked). Apply Tax is a GATE (nothing is taxed
            // when it's off, even an item explicitly marked taxable — see
            // isTaxEnabled below) and a category can OVERRIDE that gate by
            // explicitly setting isTaxable: true; it must never fill in a
            // missing per-item value.
            isTaxable: i.isTaxable === true,
            // Per-item override when set — calculateTaxBreakdown falls back
            // to defaultTaxPercentage itself when this is undefined.
            taxRate: i.taxRate,
          })),
          discountType: billingData.discountType || "flat",
          discountValue: billingData.discountValue || 0,
          defaultTaxPercentage: taxPercentage,
          // A service configured taxable on its own category (e.g. a Skin
          // Test) must still be taxed even when the invoice-level "Apply
          // Tax" toggle is off/unchecked — that toggle is a clinic-wide
          // override for invoices with no taxable items at all, not a gate
          // that should silently zero out an item explicitly marked taxable.
          isTaxEnabled:
            taxPercentage > 0 ||
            (billingData.items || []).some((i) => i.isTaxable === true),
        });

    // IRD's irdEnabled/credentials live on the Clinic document (that's what
    // Clinic Settings > IRD CBMS Configuration actually writes to) — never
    // on ClinicSettings, which has its own same-named but always-unset field.
    const clinic = await clinicService.getClinicById(billingData.clinicId);

    // The clinic's configured invoicePrefix used to be computed by
    // generateInvoiceNumber() and then silently discarded here (the Java
    // backend always used its own hardcoded "INV" default) — including for
    // credit notes, which lost their intended "CN-" distinguishing prefix
    // in the process. Pass it through instead.
    const settingsForPrefix = await this.getBillingSettings(
      billingData.clinicId,
    ).catch(() => null);
    const invoicePrefix = resolveInvoicePrefix(
      isCreditNote,
      settingsForPrefix?.invoicePrefix,
    );

    const invoiceItems = (billingData.items || []).map((item) => ({
      itemName: item.appointmentTypeName || "Service",
      quantity: item.quantity || 1,
      rate: item.price || 0,
      totalAmount: item.amount || 0,
      // Each item's own explicit setting — matches the fix to
      // calculateInvoiceTotals/resolveItemFieldsFromAppointmentType, which
      // no longer treats "unconfigured" as "taxable whenever the toggle's
      // on". This line-item flag previously still had that stale fallback.
      isTaxable: item.isTaxable === true,
    }));

    // Reserve the Firestore document id up front so the ledger row can
    // point back at this exact document. Java is called before the document
    // is written, so without pre-generating the id there would be nothing to
    // send — and the backend would later have to guess which document an
    // invoice number belongs to in order to mirror sync state onto it.
    const newBillingRef = doc(collection(db, APPOINTMENT_BILLING_COLLECTION));

    // Only intent (irdEnabled) travels to the Java backend — actual IRD
    // credentials are resolved server-side per clinic, never sent from here.
    const invoicePayload = buildInvoicePayload({
      clinicId: billingData.clinicId,
      patientId: billingData.patientId,
      patientName: billingData.patientName,
      patientPanVat: billingData.patientPanVat,
      totalAmount: calc.totalAmount,
      taxableAmount: calc.taxableAmount,
      taxAmount: calc.taxAmount,
      exemptAmount: calc.exemptAmount,
      discountAmount: calc.totalDiscountAmount,
      paymentMethod: billingData.paymentMethod,
      irdEnabled: Boolean(clinic?.irdEnabled),
      fiscalYear: getNepaliFiscalYear(new Date()),
      // Credit notes/sales returns must route to IRD's /api/billreturn, not /api/bill.
      isReturn: isCreditNote,
      refInvoiceNumber: (billingData as any).linkedInvoiceNumber,
      reasonForReturn: (billingData as any).creditNoteReason,
      invoicePrefix,
      sourceCollection: APPOINTMENT_BILLING_COLLECTION,
      sourceDocId: newBillingRef.id,
      items: invoiceItems,
    });

    return runBlockingJavaSyncThenFirestoreWrite(
      () => billingApi.createInvoice(invoicePayload),
      async (javaResult) => {
        const cleanedData = this.deepClean(billingData);

        const data = {
          ...cleanedData,
          invoiceNumber: javaResult.invoiceNumber,
          invoiceDate: billingData.invoiceDate
            ? Timestamp.fromDate(billingData.invoiceDate)
            : Timestamp.now(),
          // Persist the SAME authoritative totals just computed/sent to
          // Java/IRD above (`calc`), instead of trusting the caller's own
          // copy of these figures on billingData — closes the gap where the
          // Firestore record (and everything read from it: Invoice Details,
          // print, PDF) could in principle diverge from what was actually
          // reported to IRD, e.g. if a future caller of createBilling ever
          // computed its own totals slightly differently than
          // calculateTaxBreakdown.
          subtotal: (calc as any).subtotal ?? billingData.subtotal,
          discountAmount:
            (calc as any).totalDiscountAmount ?? billingData.discountAmount,
          itemDiscountAmount:
            (calc as any).itemDiscountAmount ?? billingData.itemDiscountAmount,
          mainDiscountAmount:
            (calc as any).mainDiscountAmount ?? billingData.mainDiscountAmount,
          taxableAmount: calc.taxableAmount,
          taxAmount: calc.taxAmount,
          exemptAmount: calc.exemptAmount,
          totalAmount: calc.totalAmount,
          balanceAmount: calc.totalAmount - (billingData.paidAmount || 0),
          ...javaResultSyncFields(javaResult),
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        };

        await setDoc(newBillingRef, data);
        const docRef = newBillingRef;

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
      },
      "appointment",
    );
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

      if (existing) {
        const isFinalized = isBillingLocked(existing);

        // undefined/null normalized to 0 — otherwise re-sending an
        // unchanged-but-previously-unset field (e.g. discountAmount: 0 when
        // the existing record has it as undefined) reads as a "change" and
        // wrongly blocks a legitimate, purely non-financial update like
        // recording a payment. Clause ट covers "any data" (कुनैपनि तथ्याङ्क),
        // not just financial fields — patient identity, doctor, dates etc.
        // must also be frozen once finalized/synced. Only system-driven
        // bookkeeping fields (payment recording, IRD sync retries,
        // cancellation/credit-note linkage) may still change post-finalization.
        assertFinancialFieldsUnlocked(existing, billingData, isFinalized, {
          financialKeys: [
            "totalAmount",
            "subtotal",
            "taxAmount",
            "discountAmount",
            "mainDiscountAmount",
          ],
          allowlist: [
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
          ],
          financialErrorMessage:
            "IRD Tax Compliance Error: Financial fields of finalized or IRD-synced invoices cannot be modified. Issue a Credit Note instead.",
          notesErrorMessage:
            "IRD Tax Compliance Error: Notes on a finalized or IRD-synced invoice can only be appended to (e.g. cancellation/credit-note remarks), not rewritten.",
          dataErrorMessage:
            "IRD Tax Compliance Error: Data of a finalized or IRD-synced invoice cannot be modified. Issue a Credit Note instead.",
        });
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

      if (
        discountAmount > 0 &&
        isBillingLocked(billing)
      ) {
        throw new Error(
          "IRD Tax Compliance Error: Financial fields of finalized or IRD-synced invoices cannot be modified. Issue a Credit Note instead.",
        );
      }

      // Handle discount — rounded to 2 decimals throughout, matching this
      // app's established IRD monetary convention (see taxEngine.ts).
      // Without this, floating-point drift from earlier arithmetic (e.g.
      // 497.00000000000006) can make a fully-paid invoice fail the
      // newPaidAmount >= newTotalAmount check below and get stuck showing
      // "PARTIAL" forever despite the displayed paid/total amounts looking
      // identical (see the identical fix in pathologyBillingService.recordPayment).
      const round2 = (n: number) => Math.round(n * 100) / 100;
      const newTotalAmount = round2(
        Math.max(0, billing.totalAmount - discountAmount),
      );
      const newMainDiscountAmount = round2(
        (billing.mainDiscountAmount || 0) + discountAmount,
      );
      const newTotalDiscountAmount = round2(
        (billing.discountAmount || 0) + discountAmount,
      );

      const newPaidAmount = round2(billing.paidAmount + paymentAmount);
      const newBalanceAmount = round2(
        Math.max(0, newTotalAmount - newPaidAmount),
      );

      let paymentStatus: "unpaid" | "partial" | "paid" = "unpaid";

      if (newPaidAmount >= newTotalAmount) {
        paymentStatus = "paid";
      } else if (newPaidAmount > 0) {
        paymentStatus = "partial";
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

      // Atomically claim this payment (re-check + write in one
      // transaction) before any side effects — two concurrent calls
      // (double-click, a retried network request) could otherwise both
      // pass the non-atomic "already paid" check above and both proceed
      // to deduct the wallet and create commissions for a single real
      // payment. Only one of two racing transactions can win; the loser
      // throws the same "already fully paid" error instead of silently
      // double-processing.
      const billingRef = doc(db, APPOINTMENT_BILLING_COLLECTION, id);

      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(billingRef);

        if (!snap.exists()) {
          throw new Error("Billing record not found");
        }

        const current = snap.data() as AppointmentBilling;

        if (current.paymentStatus === "paid" && paymentAmount > 0) {
          throw new Error("This invoice is already fully paid.");
        }

        transaction.update(billingRef, {
          ...updateData,
          updatedAt: Timestamp.now(),
        });
      });

      // If paying via wallet, verify balance and deduct funds — after the
      // claim above succeeds, so only the winner of a concurrent race
      // reaches here. deductFunds is itself transactional (see
      // walletService.ts), so the balance check/decrement can't go
      // negative under concurrent wallet payments either.
      if (paymentMethod === "wallet") {
        try {
          const patient = await patientService.getPatientById(
            billing.patientId,
          );

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
        } catch (walletError) {
          // Compensate: revert the claim above so the invoice doesn't end
          // up looking paid when no funds were actually collected.
          await updateDoc(billingRef, {
            totalAmount: billing.totalAmount,
            mainDiscountAmount: billing.mainDiscountAmount || 0,
            discountAmount: billing.discountAmount || 0,
            paidAmount: billing.paidAmount,
            balanceAmount: billing.balanceAmount,
            paymentStatus: billing.paymentStatus,
            updatedAt: Timestamp.now(),
          });
          throw walletError;
        }
      }

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

              // Reuse an existing pending follow-up for this patient
              // (matching the dedup FollowupModal already does for manual
              // creation) instead of always inserting a new one — otherwise
              // a patient with several paid visits accumulates a separate
              // fragmented pending follow-up per visit.
              const existing = await followupService.findPendingFollowup(
                billing.patientId,
                "appointment",
              );
              // Default the next follow-up 7 days out so this actually
              // surfaces under the Today/Tomorrow filters eventually —
              // previously auto-created follow-ups never got a date at
              // all, so they were only ever visible under "All Dates".
              const nextFollowupDate = new Date();

              nextFollowupDate.setDate(nextFollowupDate.getDate() + 7);

              if (existing) {
                await followupService.updateFollowup(existing.id, {
                  billingId: id,
                  visitDate: new Date(),
                  service: services,
                  nextFollowupDate:
                    existing.nextFollowupDate || nextFollowupDate,
                });
              } else {
                await followupService.createFollowup({
                  clinicId: billing.clinicId,
                  branchId: billing.branchId || "",
                  category: "appointment",
                  patientId: billing.patientId,
                  patientName: patient.name,
                  patientMobile: patient.mobile || patient.phone || "",
                  billingId: id,
                  visitDate: new Date(),
                  session: "1st",
                  initStatus: "good",
                  overallStatus: "pending",
                  service: services,
                  nextFollowupDate,
                  createdBy: auth.currentUser?.uid || "system",
                } as any);
              }
              console.log("Auto-created/updated appointment followup for billing", id);
            }
          } catch (e) {
            console.error("Failed to auto-create followup:", e);
            // Previously silent beyond console — a failure here meant staff
            // had no way of knowing a follow-up was supposed to exist for
            // this paid invoice. Surface it into the existing Audit Logs
            // page instead of inventing new infrastructure.
            try {
              const { auditLogService } = await import("./auditLogService");

              await auditLogService.logEvent(
                "operation_failed",
                billing.clinicId,
                {
                  operation: "auto_create_followup",
                  billingId: id,
                  patientId: billing.patientId,
                },
                "failure",
                e instanceof Error ? e.message : String(e),
              );
            } catch {
              // Audit logging is itself best-effort — never let it mask the original error path.
            }
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
              // Same double-commission guard as the doctor branch above —
              // exclude items this expert already earns TREATING commission
              // on, so a referral bonus for the same expert on a different
              // item doesn't also re-count their own item, and isn't based
              // on the whole invoice subtotal instead of just the referred
              // item(s).
              const expertItemsForReferral = billing.items.filter(
                (item: any) => item.doctorId !== r.id,
              );

              if (expertItemsForReferral.length > 0) {
                const referralBillingData = {
                  ...billing,
                  items: expertItemsForReferral.map((i: any) => ({
                    ...i,
                    doctorId: undefined,
                    doctorName: undefined,
                    commission: undefined,
                  })),
                };

                await expertCommissionService.createCommission(
                  r.id,
                  r.name,
                  referralBillingData,
                  r.commissionPercentage,
                  currentUserId,
                );
              }
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
                billing.id,
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

              // Sync state is written back by the backend's mirror — the
              // client no longer asserts it.
              void javaResult;
            } else {
              // No javaInvoiceId: the invoice may still have a ledger row
              // whose id never made it back, so look it up and re-sync
              // through Java if so. If there is genuinely no ledger row the
              // sale was never filed with IRD — leave irdSynced untouched
              // and let the reconciliation report surface it. This used to
              // push straight to CBMS from the client and then mark the
              // record synced, which filed to the tax authority without ever
              // creating a ledger row.
              const { billingApi } = await import("./api/billingApi");
              const ledgerRow = await billingApi.getInvoiceByNumber(
                billing.invoiceNumber,
              );

              if (ledgerRow) {
                const javaResult = await billingApi.retryIrdSync(ledgerRow.id, {
                  fiscalYear: getNepaliFiscalYear(billing.invoiceDate),
                  isReturn: false,
                });

                // Record only the ledger link; the backend mirrors the
                // sync state onto this document itself.
                void javaResult;
                await this.updateBilling(id, { javaInvoiceId: ledgerRow.id });
              } else {
                console.warn(
                  `Invoice ${billing.invoiceNumber} has no ledger entry — it was never filed with IRD. Leaving sync state untouched for reconciliation to surface.`,
                );
              }
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
   * Resolves the fields an invoice item should take on when a specific
   * Appointment Type is selected for it: price, commission (the type's own
   * rate takes priority over the clinician's blanket default), and tax
   * settings (isTaxable/taxRate copied verbatim — undefined when the type
   * doesn't configure its own, which the billing/tax engine correctly
   * treats as NOT taxable, never as "inherit the invoice-level toggle").
   *
   * This exact lookup-and-copy logic used to be reimplemented independently
   * in every place an invoice item gets built from an Appointment Type
   * (Create Invoice, Edit Invoice, Patient Billing Tab, prescriptions'
   * auto-billing) — which is exactly how the same "isTaxable never copied
   * over" bug ended up needing to be fixed in four-plus places
   * independently instead of once. New call sites should use this instead
   * of re-deriving these fields by hand.
   */
  resolveItemFieldsFromAppointmentType(
    appointmentType: AppointmentType,
    clinicianDefaultCommission?: number,
  ): {
    appointmentTypeName: string;
    price: number;
    categoryId?: string;
    commission: number;
    calculateCommission?: boolean;
    isTaxable?: boolean;
    taxRate?: number;
  } {
    return {
      appointmentTypeName: appointmentType.name,
      price: appointmentType.price,
      categoryId: appointmentType.categoryId,
      commission:
        appointmentType.calculateCommission !== false &&
        typeof appointmentType.defaultCommission === "number"
          ? appointmentType.defaultCommission
          : clinicianDefaultCommission || 0,
      calculateCommission: appointmentType.calculateCommission,
      isTaxable: appointmentType.isTaxable,
      taxRate: appointmentType.taxRate,
    };
  },

  /**
   * Builds the full billingData for a one-off package sale (a $0-commission,
   * clinic-attributed invoice with a single "Package: <name>" item) — ready
   * to pass straight to createBilling(). TreatmentPackage has no
   * isTaxable/taxRate setting of its own (unlike AppointmentType/
   * PathologyTestType), so the invoice-level Apply Tax toggle is the ONLY
   * way to tax a package sale; this bakes that in.
   *
   * This exact construction used to be duplicated near-verbatim in both
   * front-office-desk.tsx's Quick-Intake package-sale branch and
   * SellPackageModal.tsx — a second, independent place the same
   * isTaxable-must-mirror-the-toggle fix had to land.
   */
  buildPackageSaleBillingData(params: {
    pkg: { name: string; price: number };
    clinicId: string;
    branchId?: string;
    patientId: string;
    patientName: string;
    patientPanVat?: string;
    applyTax: boolean;
    defaultTaxPercentage?: number;
    createdBy: string;
  }): Omit<AppointmentBilling, "id" | "createdAt" | "updatedAt"> {
    const {
      pkg,
      clinicId,
      branchId,
      patientId,
      patientName,
      patientPanVat,
      applyTax,
      defaultTaxPercentage,
      createdBy,
    } = params;
    const taxPercentage = applyTax ? defaultTaxPercentage || 0 : 0;

    const billingItem: AppointmentBillingItem = {
      id: crypto.randomUUID(),
      appointmentTypeId: "package-sale",
      appointmentTypeName: `Package: ${pkg.name}`,
      price: pkg.price,
      quantity: 1,
      commission: 0,
      doctorId: "unassigned",
      doctorName: "Clinic",
      amount: pkg.price,
      isTaxable: taxPercentage > 0,
    };

    const totals = this.calculateInvoiceTotals(
      [billingItem],
      "percent",
      0,
      taxPercentage,
    );

    return {
      invoiceNumber: "", // resolved by the Java backend; overwritten in createBilling
      clinicId,
      branchId: branchId || clinicId,
      patientId,
      patientName,
      patientPanVat,
      doctorId: "unassigned",
      doctorName: "Clinic",
      doctorType: "regular",
      invoiceDate: new Date(),
      items: [billingItem],
      subtotal: totals.subtotal,
      itemDiscountAmount: 0,
      mainDiscountAmount: 0,
      discountType: "percent",
      discountValue: 0,
      discountAmount: totals.totalDiscount,
      taxPercentage,
      taxAmount: totals.taxAmount,
      taxableAmount: totals.taxableAmount,
      exemptAmount: totals.exemptAmount,
      totalAmount: totals.totalAmount,
      status: "draft",
      paymentStatus: "unpaid",
      paidAmount: 0,
      balanceAmount: totals.totalAmount,
      createdBy,
    };
  },

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
        // See createBilling()'s matching comment — an item with no
        // explicit isTaxable must default to NOT taxable, never inherit
        // "taxable" just because the invoice-level toggle happens to be on.
        isTaxable: i.isTaxable === true,
        // Per-item override when set (e.g. a service taxed at a different
        // rate than the clinic default) — calculateTaxBreakdown falls back
        // to defaultTaxPercentage itself when this is undefined.
        taxRate: i.taxRate,
      })),
      discountType,
      discountValue,
      defaultTaxPercentage: taxPercentage,
      // Same reasoning as createBilling() above: a category-taxable item
      // must be taxed regardless of the invoice-level "Apply Tax" toggle.
      isTaxEnabled: taxPercentage > 0 || items.some((i) => i.isTaxable === true),
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

      const creditNoteData = buildCreditNoteSkeleton(original, {
        reason,
        createdBy,
        // Appointment billing tracks these two discount components
        // separately; pathology billing has no equivalent.
        extraNegatedFields: ["itemDiscountAmount", "mainDiscountAmount"],
      });

      // createBilling already submitted this to the Java backend with
      // isReturn: true (routed to IRD's /api/billreturn) — no separate
      // sync call needed here.
      const { id: newCreditNoteId, invoiceNumber: newCreditNoteInvoiceNumber } =
      await this.createBilling(creditNoteData);

      // Re-check hasCreditNote immediately before marking it, narrowing
      // (though not fully closing — createBilling above is a network round
      // trip to the Java backend that can't participate in a Firestore
      // transaction) the window where two concurrent issueCreditNote calls
      // could both pass the top-of-function check and both create a
      // negative-amount credit note for the same original invoice. If a
      // concurrent call already won, surface a clear error instead of
      // silently double-reversing commissions/wallet refunds below.
      const recheck = await this.getBillingById(original.id);

      if (recheck?.hasCreditNote) {
        throw new Error(
          `A Credit Note was already issued for this invoice by another action (credit note ${newCreditNoteId} was still created for invoice ${original.invoiceNumber} and needs manual review).`,
        );
      }

      // Update original invoice to note it has been reversed, and mark it
      // so a second Credit Note can never be issued against it.
      await this.updateBilling(original.id, {
        hasCreditNote: true,
        notes:
          (original.notes ? original.notes + "\n" : "") +
          `Reversed by Credit Note ${newCreditNoteInvoiceNumber} on ${new Date().toLocaleDateString()}`,
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
   * Issue a PARTIAL credit note against an already IRD-synced invoice —
   * for reversing only a portion of its value (e.g. refunding N of T
   * unused sessions on a package-sale invoice), unlike issueCreditNote's
   * always-100% reversal. Scales every item/amount by `ratio` instead of
   * negating them outright, links back to the original invoice, and syncs
   * to IRD via the same /api/billreturn path a full credit note uses — so
   * the tax authority's record of this invoice's revenue gets corrected
   * instead of silently staying overstated.
   *
   * The caller is responsible for the wallet refund and commission
   * reversal at the same ratio (see patientPackageService.refundUnusedSessions,
   * which already does both) — this function only produces the IRD-facing
   * paper trail. It never throws: a patient getting their money back must
   * never be blocked by a tax-sync technicality, so failures are logged
   * loudly for accounting to follow up on instead.
   */
  async issuePartialCreditNote(
    originalBillingId: string,
    ratio: number,
    reason: string,
    createdBy: string,
  ): Promise<string | null> {
    try {
      const clampedRatio = Math.min(1, Math.max(0, ratio));

      if (clampedRatio <= 0) return null;

      const original = await this.getBillingById(originalBillingId);

      if (!original) {
        console.error(
          `Cannot issue partial credit note: billing ${originalBillingId} not found.`,
        );

        return null;
      }

      if (!original.irdSynced) {
        console.warn(
          `Skipping IRD partial credit note for billing ${originalBillingId} — original invoice was never IRD-synced.`,
        );

        return null;
      }

      if (original.hasCreditNote) {
        console.warn(
          `Skipping IRD partial credit note for billing ${originalBillingId} — a credit note already exists for it.`,
        );

        return null;
      }

      const pct = Math.round(clampedRatio * 100);
      const creditNoteData = buildCreditNoteSkeleton(original, {
        reason,
        createdBy,
        ratio: clampedRatio,
        extraNegatedFields: ["itemDiscountAmount", "mainDiscountAmount"],
      });

      const {
        id: newCreditNoteId,
        invoiceNumber: newCreditNoteInvoiceNumber,
      } = await this.createBilling(creditNoteData);

      // Same narrow concurrent-issue guard as issueCreditNote.
      const recheck = await this.getBillingById(original.id);

      if (recheck?.hasCreditNote) {
        console.error(
          `A Credit Note was already issued for invoice ${original.invoiceNumber} by another action — partial credit note ${newCreditNoteId} was still created for it and needs manual review.`,
        );

        return newCreditNoteId;
      }

      await this.updateBilling(original.id, {
        hasCreditNote: true,
        notes:
          (original.notes ? original.notes + "\n" : "") +
          `Partially reversed (${pct}%) by Credit Note ${newCreditNoteInvoiceNumber} on ${new Date().toLocaleDateString()}`,
      });

      return newCreditNoteId;
    } catch (error) {
      console.error("Error issuing partial credit note:", error);

      return null;
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
