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
import {
  isRecordLocked,
  assertFinancialFieldsUnlocked,
  assertOnline,
  resolveInvoicePrefix,
  javaResultSyncFields,
  runBlockingJavaSyncThenFirestoreWrite,
  resolveReplayTarget,
  buildCreditNoteSkeleton,
} from "./core/billingLifecycleCore";

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
      // A bad value here silently reaches every future invoice's tax
      // calculation, including ones synced to IRD — reject out-of-range
      // values instead of writing them.
      if (
        settings.defaultTaxPercentage !== undefined &&
        (settings.defaultTaxPercentage < 0 || settings.defaultTaxPercentage > 100)
      ) {
        throw new Error("Default tax percentage must be between 0 and 100.");
      }
      if (
        settings.defaultDiscountValue !== undefined &&
        settings.defaultDiscountValue < 0
      ) {
        throw new Error("Default discount value cannot be negative.");
      }

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
    assertOnline();

    const { billingApi, buildInvoicePayload } = await import(
      "./api/billingApi"
    );
    const { clinicService } = await import("./clinicService");
    const { getNepaliFiscalYear } = await import("./irdCbmsService");

    // IRD's irdEnabled/credentials live on the Clinic document (that's what
    // Clinic Settings > IRD CBMS Configuration actually writes to) — never
    // on ClinicSettings, which has its own same-named but always-unset field.
    const clinic = await clinicService.getClinicById(billingData.clinicId);

    const taxPercentage = billingData.taxPercentage || 0;
    const taxAmount = billingData.taxAmount || 0;
    const totalAmount = billingData.totalAmount || 0;
    // Trust the per-item, category-driven breakdown the create-invoice form
    // already computed via calculateTaxBreakdown (billingData.taxableAmount/
    // exemptAmount) instead of recomputing a cruder all-or-nothing split
    // here — this used to derive taxableAmount purely from the blanket
    // invoice-level taxPercentage, so a mixed invoice (some tests taxable,
    // some exempt at the catalog level) reported the WRONG split to
    // IRD/MySQL even though the Firestore record and printed invoice
    // (which do use billingData's real figures) showed the correct one.
    const taxableAmount = billingData.taxableAmount ?? 0;
    const exemptAmount = billingData.exemptAmount ?? 0;

    // Mirrors calculateTaxBreakdown's own gating exactly (see
    // PathologyBillingTab.tsx's calculateTotals): the invoice-level toggle
    // OR any explicitly-taxable item turns tax on overall, and each item's
    // OWN isTaxable defaults to true (per PathologyBillingItem.isTaxable's
    // documented default) unless explicitly set false.
    const isTaxEnabledOverall =
      taxPercentage > 0 ||
      (billingData.items || []).some((i) => i.isTaxable === true);

    const invoiceItems = (billingData.items || []).map((item) => ({
      itemName: item.testName || "Pathology Test",
      quantity: 1,
      rate: item.price || 0,
      totalAmount: item.price || 0,
      // Each item's own resolved taxable state, not a blanket "taxable iff
      // the invoice-level toggle is on" that ignored per-item catalog
      // configuration and could mark an explicitly-taxable test as exempt
      // to IRD whenever staff forgot to flip the invoice toggle (or vice
      // versa, tax an item explicitly configured exempt).
      isTaxable: isTaxEnabledOverall && item.isTaxable !== false,
    }));

    // The clinic's configured invoicePrefix used to be computed by this
    // service's own generateInvoiceNumber() and then silently discarded —
    // the Java backend always fell back to its hardcoded "INV" default,
    // including for credit notes (losing their intended "CN-" prefix).
    // Mirrors appointmentBillingService.createBilling's same fix.
    const isCreditNote = Boolean((billingData as any).isCreditNote);
    const settingsForPrefix = await this.getBillingSettings(
      billingData.clinicId,
    ).catch(() => null);
    const invoicePrefix = resolveInvoicePrefix(
      isCreditNote,
      settingsForPrefix?.invoicePrefix,
    );

    // Reserve the Firestore document id up front so the ledger row can point
    // back at this exact document — Java is called before the document is
    // written, so without this there would be no id to send.
    const newBillingRef = doc(collection(db, PATHOLOGY_BILLING_COLLECTION));

    // Only intent (irdEnabled) travels to the Java backend — actual IRD
    // credentials are resolved server-side per clinic, never sent from here.
    const invoicePayload = buildInvoicePayload({
      clinicId: billingData.clinicId,
      patientId: billingData.patientId,
      patientName: billingData.patientName,
      patientPanVat: billingData.patientPanVat,
      totalAmount,
      taxableAmount,
      taxAmount,
      exemptAmount,
      discountAmount: billingData.discountAmount,
      paymentMethod: billingData.paymentMethod,
      irdEnabled: Boolean(clinic?.irdEnabled),
      fiscalYear: getNepaliFiscalYear(new Date()),
      // Credit notes/sales returns must route to IRD's /api/billreturn, not /api/bill.
      isReturn: isCreditNote,
      refInvoiceNumber: (billingData as any).linkedInvoiceNumber,
      reasonForReturn: (billingData as any).creditNoteReason,
      invoicePrefix,
      sourceCollection: PATHOLOGY_BILLING_COLLECTION,
      sourceDocId: newBillingRef.id,
      items: invoiceItems,
    });

    return runBlockingJavaSyncThenFirestoreWrite(
      () => billingApi.createInvoice(invoicePayload),
      async (javaResult) => {

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
        ...javaResultSyncFields(javaResult),
        createdAt: now,
        updatedAt: now,
      };

        // The backend may have returned an invoice it had already created
      // (idempotent replay). Writing our own fresh document in that case
      // would leave one ledger row with two app invoices under the same
      // number, so follow the pointer the ledger row actually holds.
      const { isReplay, targetDocId } = resolveReplayTarget(
        javaResult,
        newBillingRef.id,
      );
      const targetRef = isReplay
        ? doc(db, PATHOLOGY_BILLING_COLLECTION, targetDocId)
        : newBillingRef;

      if (isReplay) {
        const alreadyThere = await getDoc(targetRef);

        if (alreadyThere.exists()) {
          return { id: targetRef.id, invoiceNumber: javaResult.invoiceNumber };
        }
      }

      await setDoc(targetRef, data);
      const docRef = targetRef;

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
      },
      "pathology",
    );
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
        // Pathology additionally locks on status "paid" — appointment
        // billing does not, since appointment's payment flow never reaches
        // "paid" as a terminal status the same way. Preserved exactly via
        // extraLockedStatuses rather than folding the two domains' rules
        // together.
        const isFinalized = isRecordLocked(existingData, ["paid"]);

        // Numeric fields are compared with undefined/null normalized to 0 —
        // otherwise re-sending an unchanged-but-previously-unset field (e.g.
        // discountAmount: 0 when the existing record has it as undefined)
        // reads as a "change" and wrongly blocks a legitimate, purely
        // non-financial update like recording a payment. Clause ट covers
        // "any data" (कुनैपनि तथ्याङ्क), not just financial fields — patient
        // identity, doctor, dates etc. must also be frozen once
        // finalized/synced. Only system-driven bookkeeping fields (payment
        // recording, IRD sync retries, cancellation/credit-note linkage) may
        // still change post-finalization.
        assertFinancialFieldsUnlocked(existingData, billingData, isFinalized, {
          financialKeys: ["totalAmount", "subtotal", "taxAmount", "discountAmount"],
          allowlist: [
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
          ],
          financialErrorMessage:
            "IRD Tax Compliance Error: Financial fields of a finalized or IRD-synced pathology invoice cannot be modified. Issue a Credit Note to make adjustments.",
          notesErrorMessage:
            "IRD Tax Compliance Error: Notes on a finalized or IRD-synced pathology invoice can only be appended to (e.g. cancellation/credit-note remarks), not rewritten.",
          dataErrorMessage:
            "IRD Tax Compliance Error: Data of a finalized or IRD-synced pathology invoice cannot be modified. Issue a Credit Note to make adjustments.",
        });
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

      // Commission for referring sources is intentionally NOT created here —
      // finalizing an invoice does not mean the clinic has been paid.
      // Commission generation moved to recordPayment() (gated on the
      // unpaid/partial -> paid transition), matching how appointment
      // billing already works — see appointmentBillingService.recordPayment.
      // Previously this ran unconditionally on finalize, so a finalized but
      // never-paid (or later-cancelled-before-payment) invoice could still
      // generate a referring doctor's commission on money never collected.
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

    // Same rule as appointmentBillingService.cancelBilling: a filed invoice
    // can only be reversed by Credit Note, never withdrawn.
    if (billing.irdSynced === true) {
      throw new Error(
        `Invoice ${billing.invoiceNumber} has already been filed with IRD and cannot be cancelled. Issue a Credit Note to reverse it.`,
      );
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

      const creditNoteData = buildCreditNoteSkeleton(original, {
        reason,
        createdBy,
      });

      // createBilling already submitted this to the Java backend with
      // isReturn: true (routed to IRD's /api/billreturn) — no separate
      // sync call needed here. Its returned invoiceNumber is the real,
      // Java-sequence-assigned number — this used to be pre-computed
      // locally beforehand and used for the note below, but createBilling
      // always overwrites invoiceNumber with the Java-assigned one, so
      // that locally-guessed number never matched what was actually saved.
      const { id: newCreditNoteId, invoiceNumber: creditNoteInvoiceNumber } =
        await this.createBilling(creditNoteData);

      // Re-check hasCreditNote immediately before marking it, narrowing
      // (though not fully closing — createBilling above is a network round
      // trip to the Java backend that can't participate in a Firestore
      // transaction) the window where two concurrent issueCreditNote calls
      // could both pass the top-of-function check and both create a
      // negative-amount credit note for the same original invoice. Mirrors
      // appointmentBillingService.issueCreditNote's same guard — this was
      // missing here entirely.
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

      // Rounded to 2 decimals throughout — matches this app's established
      // IRD monetary convention (see taxEngine.ts). Without this, floating-
      // point drift from earlier arithmetic (e.g. 497.00000000000006) can
      // make a fully-paid invoice fail the newPaidAmount >= newTotalAmount
      // check below and get stuck showing "PARTIAL" forever despite the
      // displayed paid/total amounts looking identical.
      const round2 = (n: number) => Math.round(n * 100) / 100;
      const newTotalAmount = round2(
        Math.max(0, billing.totalAmount - discountAmount),
      );
      const newDiscountAmount = round2(
        (billing.discountAmount || 0) + discountAmount,
      );
      const newPaidAmount = round2((billing.paidAmount || 0) + paymentAmount);
      const newBalanceAmount = round2(
        Math.max(0, newTotalAmount - newPaidAmount),
      );

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

      // Create commissions for referring sources — strictly on the
      // unpaid/partial -> paid transition (never re-fires on an already-paid
      // invoice, and never fires on finalize/draft), matching
      // appointmentBillingService.recordPayment's timing.
      if (
        paymentStatus === "paid" &&
        billing.paymentStatus !== "paid" &&
        billing.referringDoctors &&
        billing.referringDoctors.length > 0
      ) {
        for (const refDoc of billing.referringDoctors) {
          if (refDoc.calculatedAmount <= 0) continue;

          try {
            if (refDoc.type === "partner") {
              const partnerData = {
                id: refDoc.doctorId,
                name: refDoc.doctorName,
                defaultCommission: refDoc.commissionValue,
              } as any;

              await referralCommissionService.createPathologyCommission(
                billing,
                partnerData,
                refDoc.calculatedAmount,
                recordedBy || "system",
              );
            } else {
              await doctorCommissionService.createPathologyCommissions(
                { ...billing, referringDoctors: [refDoc] } as any,
                recordedBy || "system",
              );
            }
          } catch (commErr) {
            console.error(
              "Error creating pathology referral commission on payment:",
              commErr,
            );
          }
        }
      }

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

            // Reuse an existing pending follow-up for this patient instead
            // of always inserting a new one — see the identical fix in
            // appointmentBillingService.recordPayment.
            const existing = await followupService.findPendingFollowup(
              billing.patientId,
              "pathology",
            );
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
                category: "pathology",
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
                createdBy: recordedBy || "system",
              } as any);
            }
            console.log("Auto-created/updated pathology followup for billing", id);
          }
        } catch (e) {
          console.error("Failed to auto-create followup:", e);
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
            // best-effort — never mask the original error path
          }
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
