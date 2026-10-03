import NepaliDate from "nepali-datetime";

import { auth } from "../config/firebase";

/**
 * Calculates the Nepali Fiscal Year (e.g., "2080.081") based on the provided date.
 */
export const getNepaliFiscalYear = (date: Date | string): string => {
  const dateObj = new Date(date);
  const nepaliDate = new NepaliDate(dateObj);
  const bsYear = nepaliDate.getYear();
  const bsMonth = nepaliDate.getMonth() + 1; // 0-indexed

  // Fiscal year in Nepal starts from Shrawan (4th month). The second
  // component is the last 3 digits of the ending year (e.g. 2080.081, not
  // 2080.81) — matches IRD's own documented sample ("2073.074") and this
  // function's own doc comment above; substring(2) previously produced only
  // 2 digits, which IRD's real CBMS API rejects as "104: model invalid"
  // (confirmed live against cbapi.ird.gov.np).
  if (bsMonth >= 4) {
    const nextYear = bsYear + 1;

    return `${bsYear}.${nextYear.toString().substring(1)}`;
  } else {
    const prevYear = bsYear - 1;

    return `${prevYear}.${bsYear.toString().substring(1)}`;
  }
};


/**
 * Apply a patch to whichever module's Firestore record this invoice lives in.
 */
async function patchLocalRecord(
  invoiceType: "appointment" | "pathology" | "pharmacy",
  invoiceId: string,
  patch: Record<string, any>,
): Promise<void> {
  if (invoiceType === "appointment") {
    const { appointmentBillingService } = await import(
      "./appointmentBillingService"
    );

    await appointmentBillingService.updateBilling(invoiceId, patch);
  } else if (invoiceType === "pathology") {
    const { pathologyBillingService } = await import(
      "./pathologyBillingService"
    );

    await pathologyBillingService.updateBilling(invoiceId, patch);
  } else if (invoiceType === "pharmacy") {
    const { pharmacyService } = await import("./pharmacyService");

    await pharmacyService.updateMedicinePurchase(invoiceId, patch);
  }
}

/**
 * Retry syncing a failed invoice to IRD.
 */
export const retryIrdSync = async (
  invoiceId: string,
  invoiceType: "appointment" | "pathology" | "pharmacy",
  isReturn: boolean = false,
): Promise<{ success: boolean; message: string }> => {
  try {
    const { clinicSettingsService } = await import("./clinicSettingsService");
    const { clinicService } = await import("./clinicService");

    let invoiceData: any = null;
    let clinicId = "";

    // Fetch the invoice based on type
    if (invoiceType === "appointment") {
      const { appointmentBillingService } = await import(
        "./appointmentBillingService"
      );

      invoiceData = await appointmentBillingService.getBillingById(invoiceId);
      if (invoiceData) clinicId = invoiceData.clinicId;
    } else if (invoiceType === "pathology") {
      const { pathologyBillingService } = await import(
        "./pathologyBillingService"
      );

      invoiceData = await pathologyBillingService.getBillingById(invoiceId);
      if (invoiceData) clinicId = invoiceData.clinicId;
    } else if (invoiceType === "pharmacy") {
      const { pharmacyService } = await import("./pharmacyService");

      invoiceData = await pharmacyService.getMedicinePurchaseById(invoiceId);
      if (invoiceData) clinicId = invoiceData.clinicId;
    }

    if (!invoiceData) {
      return { success: false, message: "Invoice not found." };
    }

    // Ensure it's finalized (or paid for pharmacy)
    if (invoiceType === "pharmacy" && invoiceData.paymentStatus !== "paid") {
      return { success: false, message: "Pharmacy invoice is not fully paid." };
    } else if (
      invoiceType !== "pharmacy" &&
      invoiceData.status !== "finalized" &&
      invoiceData.status !== "paid"
    ) {
      return { success: false, message: "Invoice is not finalized." };
    }

    const clinicSettings =
      await clinicSettingsService.getClinicSettings(clinicId);
    const clinic = await clinicService.getClinicById(clinicId);

    if (!clinicSettings || !clinic || !clinic.irdEnabled) {
      return {
        success: false,
        message: "IRD Sync is not enabled for this clinic.",
      };
    }

    // Map the fields properly depending on the model
    const irdInvoiceData = {
      buyerName: invoiceData.patientName || "Cash Sales",
      buyerPan: "",
      invoiceNumber:
        invoiceType === "pharmacy"
          ? invoiceData.purchaseNo
          : invoiceData.invoiceNumber,
      invoiceDate:
        invoiceType === "pharmacy"
          ? invoiceData.purchaseDate || new Date()
          : invoiceData.invoiceDate,
      totalAmount:
        invoiceType === "pharmacy"
          ? invoiceData.netAmount
          : invoiceData.totalAmount,
      taxAmount: invoiceData.taxAmount || 0,
      isTaxEnabled:
        invoiceType === "pharmacy"
          ? (invoiceData.taxPercentage || 0) > 0
          : invoiceData.taxPercentage > 0,
    };

    // The MySQL ledger is the only place an invoice can legitimately be
    // filed to IRD from. A Firestore doc carrying no javaInvoiceId might
    // still have a ledger row (the id simply never made it back), so look it
    // up before concluding the sale was never filed.
    const { billingApi } = await import("./api/billingApi");
    let javaInvoiceId: number | undefined = invoiceData.javaInvoiceId;

    if (!javaInvoiceId) {
      const ledgerRow = await billingApi.getInvoiceByNumber(
        irdInvoiceData.invoiceNumber,
      );

      if (ledgerRow) {
        javaInvoiceId = ledgerRow.id;
        // Backfill so the next retry takes the fast path. Best-effort: a
        // record already (falsely) marked synced is locked by the compliance
        // guard, and that must not block the retry we can now perform.
        try {
          await patchLocalRecord(invoiceType, invoiceId, {
            javaInvoiceId: ledgerRow.id,
          });
        } catch (backfillError) {
          console.warn("Could not backfill javaInvoiceId:", backfillError);
        }
      }
    }

    if (!javaInvoiceId) {
      // No ledger row — this sale was never filed with IRD. Deliberately
      // writes NOTHING to irdSynced. The previous implementation pushed
      // straight to CBMS from the client here and then marked the record
      // synced, which left CBMS and the ledger permanently disagreeing and
      // hid an unfiled sale for good.
      return {
        success: false,
        message:
          "This sale has no entry in the official ledger, so it was never filed with IRD. It must be queued for filing and approved by an administrator — it cannot be marked synced from here.",
      };
    }

    let result: { success: boolean; responseCode?: string; message?: string };

    // Route the retry through the Java backend. Credentials are resolved
    // server-side per clinic — only fiscalYear/isReturn travel here.
    try {
      const javaResult = await billingApi.retryIrdSync(javaInvoiceId, {
        fiscalYear: getNepaliFiscalYear(irdInvoiceData.invoiceDate),
        isReturn,
      });

      // The backend mirrors the authoritative sync state onto this document
      // itself; writing it from here as well would mean two writers for one
      // fact, and the client is the one that can be wrong.

      result = {
        success: javaResult.irdSynced,
        responseCode: javaResult.cbmsResponseCode,
        message: javaResult.irdSynced
          ? "Java Backend Sync Success"
          : "Java Backend Sync Failed",
      };
    } catch (err: any) {
      result = { success: false, responseCode: "500", message: err.message };
    }

    // Log the sync attempt (success or failure)
    try {
      const { auditLogService } = await import("./auditLogService");

      await auditLogService.logIrdSync({
        // The Firestore rule for audit_logs requires performedBy to match
        // the authenticated caller's uid — "system" as a literal always
        // fails that check, so fall back to it only when truly unauthenticated.
        performedBy: auth.currentUser?.uid || "system",
        clinicId: clinicId,
        invoiceNumber: irdInvoiceData.invoiceNumber,
        status: result.success ? "success" : "failure",
        responseCode: result.responseCode,
        errorMessage: result.message,
      });
    } catch (auditErr) {
      console.warn("Failed to record audit log for IRD sync retry:", auditErr);
    }

    return {
      success: result.success,
      message: result.message || "Sync attempt finished.",
    };
  } catch (error: any) {
    console.error("Retry sync error:", error);

    return {
      success: false,
      message: error.message || "Error during retry sync.",
    };
  }
};
