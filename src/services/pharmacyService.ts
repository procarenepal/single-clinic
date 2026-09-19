import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
  runTransaction,
  serverTimestamp,
  increment,
} from "firebase/firestore";

import { db } from "../config/firebase";
import {
  MedicinePurchase,
  MedicinePurchaseReturn,
  MedicineUsage,
  PharmacySettings,
  PaymentMethod,
} from "../types/models";

const MEDICINE_PURCHASES_COLLECTION = "medicinePurchases";
const MEDICINE_USAGE_COLLECTION = "medicineUsage";
const PHARMACY_SETTINGS_COLLECTION = "pharmacySettings";

/**
 * Service for managing pharmacy operations including purchases, usage tracking, and settings
 */
export const pharmacyService = {
  // =================== MEDICINE PURCHASES ===================

  /**
   * Create a new medicine purchase record. Also decreases stock for medicine
   * items and creates stock transactions (all atomic, inside one Firestore
   * transaction). The Java backend + MySQL ledger/IRD sync happens after
   * that transaction commits — see the inline comment at the sync call site
   * for why a sync failure here doesn't throw, unlike appointment/pathology
   * billing.
   */
  async createMedicinePurchase(
    purchaseData: Omit<MedicinePurchase, "id" | "createdAt" | "updatedAt"> & {
      purchaseNo?: string;
    },
  ): Promise<{
    id: string;
    purchaseNo: string;
    irdSynced: boolean;
    javaInvoiceId?: number;
    javaSyncError?: string;
  }> {
    try {
      const { getNepaliFiscalYear } = await import("./irdCbmsService");
      const currentRealFiscalYear = getNepaliFiscalYear(new Date());
      const medicineItems = purchaseData.items.filter(
        (item) => item.type === "medicine" || !item.type,
      );

      // Pre-fetch all active stock batch document references for the medicine IDs
      const medicineIds = Array.from(
        new Set(medicineItems.map((item) => item.medicineId)),
      );
      const allStockRefs: Record<string, { docRef: any; id: string }[]> = {};

      for (const medicineId of medicineIds) {
        const q = query(
          collection(db, "medicineStock"),
          where("medicineId", "==", medicineId),
          where("clinicId", "==", purchaseData.clinicId),
        );
        const snap = await getDocs(q);

        allStockRefs[medicineId] = snap.docs.map((docVal) => ({
          docRef: docVal.ref,
          id: docVal.id,
        }));
      }

      const purchaseIdObj = await runTransaction(db, async (transaction) => {
        // 1. Read all active stock documents for transaction consistency
        const activeBatchesByMedicine: Record<
          string,
          { id: string; docRef: any; data: any }[]
        > = {};

        for (const medicineId of medicineIds) {
          const refs = allStockRefs[medicineId] || [];
          const loadedBatches = [];

          for (const ref of refs) {
            const snap = await transaction.get(ref.docRef);

            if (snap.exists()) {
              loadedBatches.push({
                id: ref.id,
                docRef: ref.docRef,
                data: snap.data(),
              });
            }
          }
          activeBatchesByMedicine[medicineId] = loadedBatches;
        }

        // 1.5. Read Pharmacy Settings for Atomic Invoice Number Generation
        const settingsRef = doc(
          db,
          PHARMACY_SETTINGS_COLLECTION,
          purchaseData.clinicId,
        );
        const settingsSnap = await transaction.get(settingsRef);
        let settings = settingsSnap.exists()
          ? (settingsSnap.data() as PharmacySettings)
          : null;

        let generatedPurchaseNo = purchaseData.purchaseNo; // fallback to provided

        if (settings) {
          let nextInvoiceNum = settings.nextInvoiceNumber || 1;
          const settingsUpdates: any = { updatedAt: serverTimestamp() };

          if (settings.currentFiscalYear !== currentRealFiscalYear) {
            nextInvoiceNum = 1;
            settingsUpdates.currentFiscalYear = currentRealFiscalYear;
            settingsUpdates.nextInvoiceNumber = 2;
          } else {
            settingsUpdates.nextInvoiceNumber = nextInvoiceNum + 1;
          }

          const formattedFiscalYear = currentRealFiscalYear
            .substring(2)
            .replace(".", "/");
          const prefix = settings.invoicePrefix || "PUR";

          generatedPurchaseNo = `${formattedFiscalYear}-${prefix}-${nextInvoiceNum.toString().padStart(4, "0")}`;

          transaction.update(settingsRef, settingsUpdates);
        } else if (!generatedPurchaseNo) {
          generatedPurchaseNo = `PUR-${Date.now()}`;
        }

        // 2. Prepare data for updates
        const stockUpdates: { docRef: any; data: any }[] = [];
        const medicineTotalUpdates: Record<
          string,
          { regularQty: number; schemeQty: number }
        > = {};
        const transactionLogs: any[] = [];
        const updatedPurchaseItems: any[] = [];
        let newGrossTotal = 0;

        for (const item of purchaseData.items) {
          if (item.type !== "medicine" && item.type !== undefined) {
            // Pass-through non-medicine items
            updatedPurchaseItems.push(item);
            newGrossTotal += item.amount || 0;
            continue;
          }

          const batches = activeBatchesByMedicine[item.medicineId] || [];
          const now = new Date();

          // A. Filter out expired batches (expiryDate < now)
          const activeNonExpiredBatches = batches.filter((b) => {
            if (!b.data.expiryDate) return true; // Treat no expiry as non-expired
            const exp = b.data.expiryDate.toDate
              ? b.data.expiryDate.toDate()
              : new Date(b.data.expiryDate);

            return exp >= now;
          });

          // B. Sort active batches by expiryDate ascending (FEFO).
          // If no expiryDate, place it at the end. Fallback to sorting by createdAt ascending (FIFO).
          activeNonExpiredBatches.sort((a, b) => {
            const expA = a.data.expiryDate
              ? a.data.expiryDate.toDate
                ? a.data.expiryDate.toDate().getTime()
                : new Date(a.data.expiryDate).getTime()
              : Infinity;
            const expB = b.data.expiryDate
              ? b.data.expiryDate.toDate
                ? b.data.expiryDate.toDate().getTime()
                : new Date(b.data.expiryDate).getTime()
              : Infinity;

            if (expA !== expB) return expA - expB;

            const createdA = a.data.createdAt
              ? a.data.createdAt.toDate
                ? a.data.createdAt.toDate().getTime()
                : new Date(a.data.createdAt).getTime()
              : 0;
            const createdB = b.data.createdAt
              ? b.data.createdAt.toDate
                ? b.data.createdAt.toDate().getTime()
                : new Date(b.data.createdAt).getTime()
              : 0;

            return createdA - createdB;
          });

          const stockType = (item as any).stockType || "regular";
          let remainingQty = item.quantity;
          const batchesUsed: {
            batchNumber: string;
            qty: number;
            price: number;
            expiryDate?: any;
            stockDocId: string;
          }[] = [];
          let itemTotalAmount = 0;

          // C. Iterate over sorted batches and deduct stock
          for (const batch of activeNonExpiredBatches) {
            if (remainingQty <= 0) break;

            const batchStockData = batch.data;
            const batchStockAvailable =
              stockType === "scheme"
                ? (batchStockData.schemeStock ?? 0)
                : (batchStockData.currentStock ?? 0);

            if (batchStockAvailable <= 0) continue;

            const qtyToDeduct = Math.min(remainingQty, batchStockAvailable);

            const newRegularStock =
              stockType === "regular"
                ? (batchStockData.currentStock ?? 0) - qtyToDeduct
                : (batchStockData.currentStock ?? 0);

            const newSchemeStock =
              stockType === "scheme"
                ? (batchStockData.schemeStock ?? 0) - qtyToDeduct
                : (batchStockData.schemeStock ?? 0);

            // Generate detailed stock transaction logs per batch with dynamic pricing
            const itemWithPrices = item as any;
            const regularSalePrice =
              itemWithPrices.regularSalePrice || item.salePrice;
            const schemeSalePrice =
              itemWithPrices.schemeSalePrice || item.salePrice;
            const priceToUse =
              stockType === "scheme" ? schemeSalePrice : regularSalePrice;

            // Fetch dynamic selling price for this specific batch, fallback to cart unit price if not configured
            const batchPrice =
              stockType === "scheme"
                ? (batchStockData.schemePrice ??
                  batchStockData.salePrice ??
                  priceToUse)
                : (batchStockData.salePrice ?? priceToUse);

            itemTotalAmount += batchPrice * qtyToDeduct;

            batchesUsed.push({
              batchNumber: batchStockData.batchNumber || "DEFAULT",
              qty: qtyToDeduct,
              price: batchPrice,
              expiryDate: batchStockData.expiryDate || null,
              stockDocId: batch.docRef.id,
            });

            // Queue batch-wise stock document updates
            if (!medicineTotalUpdates[item.medicineId])
              medicineTotalUpdates[item.medicineId] = {
                regularQty: 0,
                schemeQty: 0,
              };
            if (stockType === "scheme")
              medicineTotalUpdates[item.medicineId].schemeQty += qtyToDeduct;
            else
              medicineTotalUpdates[item.medicineId].regularQty += qtyToDeduct;

            stockUpdates.push({
              docRef: batch.docRef,
              data: {
                currentStock: newRegularStock,
                schemeStock: newSchemeStock,
                lastRestocked: batchStockData.lastRestocked || null,
                updatedBy: purchaseData.createdBy,
                updatedAt: serverTimestamp(),
              },
            });

            transactionLogs.push({
              medicineId: item.medicineId,
              type: "sale",
              quantity: qtyToDeduct,
              previousStock:
                stockType === "scheme"
                  ? (batchStockData.schemeStock ?? 0)
                  : (batchStockData.currentStock ?? 0),
              newStock:
                stockType === "scheme" ? newSchemeStock : newRegularStock,
              isSchemeStock: stockType === "scheme",
              salePrice: batchPrice,
              unitPrice: batchPrice,
              totalAmount: batchPrice * qtyToDeduct,
              batchNumber: batchStockData.batchNumber || "DEFAULT",
              expiryDate: batchStockData.expiryDate || null,
              referenceId: generatedPurchaseNo,
              clinicId: purchaseData.clinicId,
              branchId: purchaseData.branchId,
              createdBy: purchaseData.createdBy,
            });

            // Update our locally-held values to support repeated items in purchase list
            if (stockType === "scheme") {
              batch.data.schemeStock = newSchemeStock;
            } else {
              batch.data.currentStock = newRegularStock;
            }

            remainingQty -= qtyToDeduct;
          }

          // D. Prevent sale and throw explicit error if requested quantity exceeds non-expired batch stocks
          if (remainingQty > 0) {
            const totalActiveStock = activeNonExpiredBatches.reduce(
              (sum, b) => {
                return (
                  sum +
                  (stockType === "scheme"
                    ? (b.data.schemeStock ?? 0)
                    : (b.data.currentStock ?? 0))
                );
              },
              0,
            );

            throw new Error(
              `Insufficient non-expired stock for "${item.medicineName}". ` +
                `Requested: ${item.quantity}, Available: ${totalActiveStock + (item.quantity - remainingQty)}.`,
            );
          }

          // D2. Apply this item's own discount to its FEFO-resolved gross
          // amount before it's added to the purchase's running total —
          // per-item discount must be applied to the batch-resolved price,
          // not the client's pre-submission estimate, since batch prices can
          // legitimately differ from what the cart showed.
          const rawItemTotalAmount = itemTotalAmount;
          const itemDiscountType = (item as any).discountType || "flat";
          const itemDiscountValue = (item as any).discountValue || 0;
          let itemDiscountAmount =
            itemDiscountType === "percentage"
              ? (rawItemTotalAmount * itemDiscountValue) / 100
              : itemDiscountValue;

          itemDiscountAmount = Math.max(
            0,
            Math.min(itemDiscountAmount, rawItemTotalAmount),
          );
          itemTotalAmount = rawItemTotalAmount - itemDiscountAmount;

          newGrossTotal += itemTotalAmount;

          // E. Record exact batch numbers and prices sold in purchase item metadata
          const batchString = batchesUsed
            .map((b) => {
              let expStr = "";

              if (b.expiryDate) {
                try {
                  const d =
                    typeof b.expiryDate.toDate === "function"
                      ? b.expiryDate.toDate()
                      : new Date(b.expiryDate);

                  if (d && !isNaN(d.getTime())) {
                    expStr = d.toISOString().split("T")[0];
                  }
                } catch (e) {
                  console.error("Error formatting expiry date:", e);
                }
              }
              const expPart = expStr ? `|Exp: ${expStr}` : "";

              return `${b.batchNumber}${expPart} (x${b.qty} @ NPR ${b.price})`;
            })
            .join(", ");

          const weightedSalePrice =
            item.quantity > 0
              ? rawItemTotalAmount / item.quantity
              : item.salePrice;

          let finalExpiryDate = item.expiryDate;

          if (batchesUsed.length === 1 && batchesUsed[0].expiryDate) {
            try {
              const d =
                typeof batchesUsed[0].expiryDate.toDate === "function"
                  ? batchesUsed[0].expiryDate.toDate()
                  : new Date(batchesUsed[0].expiryDate);

              if (d && !isNaN(d.getTime())) {
                finalExpiryDate = d.toISOString().split("T")[0];
              }
            } catch (e) {
              console.error("Error parsing single batch expiry date:", e);
            }
          }

          updatedPurchaseItems.push({
            ...item,
            salePrice: weightedSalePrice,
            amount: itemTotalAmount,
            discountType: itemDiscountType,
            discountValue: itemDiscountValue,
            discountAmount: itemDiscountAmount,
            batchNumber: batchString || "DEFAULT",
            expiryDate: finalExpiryDate,
            // Structured per-batch breakdown (batchNumber above is only a
            // display string) — lets a later return restore quantity to
            // the SPECIFIC batch doc(s) this sale actually deducted from,
            // instead of guessing at whichever medicineStock doc a plain
            // medicineId query happens to return first.
            batchAllocations: batchesUsed.map((b) => ({
              stockDocId: b.stockDocId,
              quantity: b.qty,
            })),
          });
        }

        // F. Calculate final consistent parent totals based on dynamic batch items
        const finalDiscount = Math.min(
          purchaseData.discount || 0,
          newGrossTotal,
        );

        const taxableAmount = Math.max(0, newGrossTotal - finalDiscount);
        const finalTaxAmount = Math.round(
          taxableAmount * ((purchaseData.taxPercentage || 0) / 100),
        );
        const finalNetAmount = Math.round(taxableAmount + finalTaxAmount);

        // 3. Perform Writes
        // Create Purchase/Invoice with batch-filled items and dynamically computed totals
        const purchaseRef = doc(collection(db, MEDICINE_PURCHASES_COLLECTION));

        transaction.set(purchaseRef, {
          ...purchaseData,
          purchaseNo: generatedPurchaseNo,
          items: updatedPurchaseItems,
          total: newGrossTotal,
          discount: finalDiscount,
          taxAmount: finalTaxAmount,
          netAmount: finalNetAmount,
          id: purchaseRef.id,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        // Update Parent Medicine Totals
        for (const [medId, deductions] of Object.entries(
          medicineTotalUpdates,
        )) {
          const medRef = doc(collection(db, "medicines"), medId);
          const updates: any = {};

          if (deductions.regularQty > 0)
            updates.totalStock = increment(-deductions.regularQty);
          if (deductions.schemeQty > 0)
            updates.totalSchemeStock = increment(-deductions.schemeQty);
          if (Object.keys(updates).length > 0)
            transaction.update(medRef, updates);
        }

        // Update Stock Batch Documents
        for (const update of stockUpdates) {
          transaction.update(update.docRef, update.data);
        }

        // Create Stock Transactions
        for (const log of transactionLogs) {
          const logRef = doc(collection(db, "stockTransactions"));

          transaction.set(logRef, {
            ...log,
            createdAt: serverTimestamp(),
          });
        }

        return {
          id: purchaseRef.id,
          purchaseNo: generatedPurchaseNo,
          items: updatedPurchaseItems,
          total: newGrossTotal,
          discount: finalDiscount,
          taxAmount: finalTaxAmount,
          netAmount: finalNetAmount,
        };
      });

      // Auto-create follow-up if paid
      if (purchaseData.paymentStatus === "paid" && purchaseData.patientName) {
        try {
          const { followupService } = await import("./followupService");

          const products = purchaseData.items
            .map((item) => item.medicineName || (item as any).description)
            .filter(Boolean)
            .join(", ");

          // A shared constant "walk-in-pharmacy" patientId collapsed every
          // walk-in customer's follow-ups under one identity — any query by
          // patientId (including the dedup lookup below) would mix them
          // together. Scope walk-ins to this specific purchase instead, so
          // each walk-in sale gets its own distinct pseudo-identity.
          const patientId =
            (purchaseData as any).patientId ||
            `walk-in-pharmacy-${purchaseIdObj.id}`;
          const isRealPatient = Boolean((purchaseData as any).patientId);

          const existing = isRealPatient
            ? await followupService.findPendingFollowup(patientId, "pharmacy")
            : null;
          const nextFollowupDate = new Date();

          nextFollowupDate.setDate(nextFollowupDate.getDate() + 7);

          if (existing) {
            await followupService.updateFollowup(existing.id, {
              purchaseId: purchaseIdObj.id,
              visitDate: new Date(),
              product: products,
              nextFollowupDate:
                existing.nextFollowupDate || nextFollowupDate,
            });
          } else {
            await followupService.createFollowup({
              clinicId: purchaseData.clinicId,
              branchId: purchaseData.branchId || "",
              category: "pharmacy",
              patientId,
              patientName: purchaseData.patientName,
              patientMobile: purchaseData.patientPhone || "",
              purchaseId: purchaseIdObj.id,
              visitDate: new Date(),
              session: "1st",
              initStatus: "good",
              overallStatus: "pending",
              product: products,
              nextFollowupDate,
              createdBy: purchaseData.createdBy || "system",
            } as any);
          }
          console.log(
            "Auto-created/updated pharmacy followup for purchase",
            purchaseIdObj.id,
          );
        } catch (e) {
          console.error("Failed to auto-create pharmacy followup:", e);
          try {
            const { auditLogService } = await import("./auditLogService");

            await auditLogService.logEvent(
              "operation_failed",
              purchaseData.clinicId,
              {
                operation: "auto_create_followup",
                purchaseId: purchaseIdObj.id,
                patientId: (purchaseData as any).patientId,
              },
              "failure",
              e instanceof Error ? e.message : String(e),
            );
          } catch {
            // best-effort — never mask the original error path
          }
        }
      }
      // Java backend + MySQL is the sole authority for IRD sync. It's called
      // here — AFTER the Firestore transaction — because the final amounts
      // (batch-resolved pricing) and the receipt number (generatedPurchaseNo,
      // allocated atomically inside the transaction above) only exist once
      // the transaction has committed. Stock has already been deducted and
      // the sale has already physically happened by this point, so unlike
      // appointment/pathology billing, a Java/IRD failure here must NOT throw
      // (that would misrepresent a completed sale as failed and risk a
      // double-submission retry). Instead it's recorded honestly on the
      // purchase record and surfaced to the caller via the return value.
      let irdSynced = false;
      let javaInvoiceId: number | undefined;
      let javaSyncError: string | undefined;

      try {
        const { billingApi } = await import("./api/billingApi");
        const { getNepaliFiscalYear } = await import("./irdCbmsService");
        const { clinicService } = await import("./clinicService");
        const { computeIdempotencyKey } = await import(
          "../utils/idempotencyKey"
        );
        // IRD's irdEnabled lives on the Clinic document (that's what Clinic
        // Settings > IRD CBMS Configuration actually writes to) — never on
        // ClinicSettings, which has its own same-named but always-unset field.
        const javaClinic = await clinicService.getClinicById(
          purchaseData.clinicId,
        );
        // Use the transaction's FEFO-resolved, discount-applied items and
        // totals (purchaseIdObj) rather than the client-submitted
        // purchaseData — batch pricing and per-item discounts are only known
        // once the transaction above has run, and IRD must be told the real
        // sold amounts, not the pre-submission estimate.
        const finalItems = purchaseIdObj.items || purchaseData.items;
        const finalNetAmount = purchaseIdObj.netAmount ?? purchaseData.netAmount ?? 0;
        const finalTaxAmountForIrd = purchaseIdObj.taxAmount ?? purchaseData.taxAmount ?? 0;
        const finalDiscountForIrd = purchaseIdObj.discount ?? purchaseData.discount;

        const invoiceItems = finalItems.map((item: any) => ({
          itemName:
            item.medicineName || (item as any).description || "Medicine",
          quantity: item.quantity || 1,
          rate: item.amount / item.quantity || 0,
          totalAmount: item.amount || 0,
          isTaxable: (purchaseData.taxPercentage || 0) > 0,
        }));
        const payload = {
          firebasePatientId: (purchaseData as any).patientId || "",
          buyerName: purchaseData.patientName || "Cash Sales",
          buyerPan: (purchaseData as any).patientPanVat || "",
          totalAmount: finalNetAmount,
          taxableAmount:
            finalTaxAmountForIrd > 0
              ? finalNetAmount - finalTaxAmountForIrd
              : 0,
          taxAmount: finalTaxAmountForIrd,
          exemptAmount: finalTaxAmountForIrd === 0 ? finalNetAmount : 0,
          discountAmount: finalDiscountForIrd,
          paymentMethod: purchaseData.paymentType,
          irdEnabled: Boolean(javaClinic?.irdEnabled),
          fiscalYear: getNepaliFiscalYear(
            purchaseData.purchaseDate || new Date(),
          ),
          preAssignedInvoiceNumber: purchaseIdObj.purchaseNo,
          // Deterministic per-content key — a network-drop retry of this
          // exact submission reuses it, so the backend returns the
          // already-created invoice instead of minting a duplicate.
          idempotencyKey: computeIdempotencyKey({
            clinicId: purchaseData.clinicId,
            buyerName: purchaseData.patientName || "Cash Sales",
            totalAmount: finalNetAmount,
            items: invoiceItems,
          }),
          items: invoiceItems,
        };

        const result = await billingApi.createInvoice(payload);

        irdSynced = Boolean(result?.irdSynced);
        javaInvoiceId = result?.id;

        const docRef = doc(db, MEDICINE_PURCHASES_COLLECTION, purchaseIdObj.id);

        await updateDoc(docRef, {
          javaInvoiceId: result.id,
          irdSynced,
          irdSyncDate: irdSynced ? new Date() : null,
          cbmsResponseCode: result.cbmsResponseCode || null,
        });
        console.log(
          "Pharmacy purchase synced to Java backend with ID:",
          result.id,
        );
      } catch (javaError: any) {
        javaSyncError = javaError.message || String(javaError);
        console.error(
          "Pharmacy purchase saved, but Java backend/IRD sync failed:",
          javaSyncError,
        );
        try {
          const docRef = doc(
            db,
            MEDICINE_PURCHASES_COLLECTION,
            purchaseIdObj.id,
          );

          await updateDoc(docRef, {
            irdSynced: false,
            cbmsResponseCode: "SYNC_FAILED",
          });
        } catch {
          // Best-effort status flag only — the sale itself is already committed.
        }
      }

      return {
        id: purchaseIdObj.id,
        purchaseNo: purchaseIdObj.purchaseNo || "",
        irdSynced,
        javaInvoiceId,
        javaSyncError,
      };
    } catch (error) {
      console.error("Error creating medicine purchase:", error);
      throw error;
    }
  },

  /**
   * Get a medicine purchase by ID
   */
  async getMedicinePurchaseById(id: string): Promise<MedicinePurchase | null> {
    try {
      const docRef = doc(db, MEDICINE_PURCHASES_COLLECTION, id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        const purchase: MedicinePurchase = {
          id: docSnap.id,
          ...data,
          purchaseDate: data.purchaseDate?.toDate(),
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as MedicinePurchase;

        // Normalise returns array date fields (if any)
        if (Array.isArray((data as any).returns)) {
          purchase.returns = (data as any).returns.map((ret: any) => ({
            ...ret,
            createdAt: ret.createdAt?.toDate
              ? ret.createdAt.toDate()
              : ret.createdAt,
          })) as MedicinePurchaseReturn[];
        }

        return purchase;
      }

      return null;
    } catch (error) {
      console.error("Error getting medicine purchase:", error);
      throw error;
    }
  },

  /**
   * Get all medicine purchases for a clinic
   */
  async getMedicinePurchasesByClinic(
    clinicId: string,
  ): Promise<MedicinePurchase[]> {
    try {
      const purchasesRef = collection(db, MEDICINE_PURCHASES_COLLECTION);
      const constraints: any[] = [where("clinicId", "==", clinicId)];

      const q = query(purchasesRef, ...constraints);
      const querySnapshot = await getDocs(q);

      const purchases = querySnapshot.docs.map((doc) => {
        const data = doc.data();

        return {
          id: doc.id,
          ...data,
          purchaseDate: data.purchaseDate?.toDate(),
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as MedicinePurchase;
      });

      return purchases.sort((a, b) => {
        const dateA = a.purchaseDate
          ? a.purchaseDate instanceof Date
            ? a.purchaseDate.getTime()
            : new Date(a.purchaseDate).getTime()
          : 0;
        const dateB = b.purchaseDate
          ? b.purchaseDate instanceof Date
            ? b.purchaseDate.getTime()
            : new Date(b.purchaseDate).getTime()
          : 0;

        return dateB - dateA;
      });
    } catch (error) {
      console.error("Error getting medicine purchases:", error);
      throw error;
    }
  },

  /**
   * Get all medicine purchases for a specific patient within a clinic.
   * Note: `patientId` isn't a typed field on `MedicinePurchase` — walk-in
   * sales are stored with `patientId: "walk-in-pharmacy"` and never match
   * a real patient here.
   */
  async getMedicinePurchasesByPatient(
    patientId: string,
    clinicId: string,
  ): Promise<MedicinePurchase[]> {
    try {
      const purchasesRef = collection(db, MEDICINE_PURCHASES_COLLECTION);
      const q = query(
        purchasesRef,
        where("clinicId", "==", clinicId),
        where("patientId", "==", patientId),
      );
      const querySnapshot = await getDocs(q);

      const purchases = querySnapshot.docs.map((doc) => {
        const data = doc.data();

        return {
          id: doc.id,
          ...data,
          purchaseDate: data.purchaseDate?.toDate(),
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as MedicinePurchase;
      });

      return purchases.sort((a, b) => {
        const dateA = a.purchaseDate
          ? a.purchaseDate instanceof Date
            ? a.purchaseDate.getTime()
            : new Date(a.purchaseDate).getTime()
          : 0;
        const dateB = b.purchaseDate
          ? b.purchaseDate instanceof Date
            ? b.purchaseDate.getTime()
            : new Date(b.purchaseDate).getTime()
          : 0;

        return dateB - dateA;
      });
    } catch (error) {
      console.error("Error getting medicine purchases by patient:", error);
      throw error;
    }
  },

  /**
   * Update a medicine purchase
   */
  async updateMedicinePurchase(
    id: string,
    updateData: Partial<
      Omit<MedicinePurchase, "id" | "createdAt" | "updatedAt">
    >,
  ): Promise<void> {
    try {
      const docRef = doc(db, MEDICINE_PURCHASES_COLLECTION, id);
      const prevDoc = await getDoc(docRef);
      const prevData = prevDoc.exists() ? prevDoc.data() : null;

      // IRD COMPLIANCE (Clause 6(ख)/(ट)): once a purchase is synced to IRD,
      // neither its financial fields nor any other business/identity data
      // may be silently modified — this function previously had no guard at
      // all, unlike its appointment/pathology billing counterparts. Only
      // system-driven bookkeeping fields (payment recording, sync retries)
      // may still change post-sync.
      if (prevData && (prevData as any).irdSynced) {
        const financialKeys = [
          "total",
          "discount",
          "taxPercentage",
          "taxAmount",
          "netAmount",
        ];
        const allowedPostSyncFields = new Set([
          "paymentStatus",
          "paymentHistory",
          "printCount",
          "irdSynced",
          "irdSyncDate",
          "cbmsResponseCode",
          "updatedAt",
          "updatedBy",
        ]);

        for (const key of Object.keys(updateData)) {
          if (allowedPostSyncFields.has(key)) continue;

          const oldVal = (prevData as any)[key];
          const newVal = (updateData as any)[key];
          const changed =
            typeof newVal === "object" && newVal !== null
              ? JSON.stringify(newVal) !== JSON.stringify(oldVal)
              : (newVal || 0) !== (oldVal || 0);

          if (!changed) continue;

          if (financialKeys.includes(key) || key === "items") {
            throw new Error(
              "IRD Tax Compliance Error: Financial fields of an IRD-synced purchase cannot be modified. Issue a Return instead.",
            );
          }

          throw new Error(
            "IRD Tax Compliance Error: Data of an IRD-synced purchase cannot be modified. Issue a Return instead.",
          );
        }
      }

      await updateDoc(docRef, {
        ...updateData,
        updatedAt: Timestamp.now(),
      });

      // Auto-create follow-up if status changes to paid
      if (
        updateData.paymentStatus === "paid" &&
        prevData &&
        prevData.paymentStatus !== "paid" &&
        (updateData.patientName || prevData.patientName)
      ) {
        try {
          const { followupService } = await import("./followupService");

          const patientName = updateData.patientName || prevData.patientName;
          const patientPhone =
            updateData.patientPhone || prevData.patientPhone || "";
          const products =
            prevData.items
              ?.map((item: any) => item.medicineName || item.description)
              .filter(Boolean)
              .join(", ") || "";

          const patientId = prevData.patientId || `walk-in-pharmacy-${id}`;
          const isRealPatient = Boolean(prevData.patientId);

          const existing = isRealPatient
            ? await followupService.findPendingFollowup(patientId, "pharmacy")
            : null;
          const nextFollowupDate = new Date();

          nextFollowupDate.setDate(nextFollowupDate.getDate() + 7);

          if (existing) {
            await followupService.updateFollowup(existing.id, {
              purchaseId: id,
              visitDate: new Date(),
              product: products,
              nextFollowupDate:
                existing.nextFollowupDate || nextFollowupDate,
            });
          } else {
            await followupService.createFollowup({
              clinicId: prevData.clinicId,
              branchId: prevData.branchId || "",
              category: "pharmacy",
              patientId,
              patientName: patientName,
              patientMobile: patientPhone,
              purchaseId: id,
              visitDate: new Date(),
              session: "1st",
              initStatus: "good",
              overallStatus: "pending",
              product: products,
              nextFollowupDate,
              createdBy: prevData.createdBy || "system",
            } as any);
          }
          console.log(
            "Auto-created/updated pharmacy followup after update for purchase",
            id,
          );
        } catch (e) {
          console.error("Failed to auto-create pharmacy followup:", e);
          try {
            const { auditLogService } = await import("./auditLogService");

            await auditLogService.logEvent(
              "operation_failed",
              prevData.clinicId,
              {
                operation: "auto_create_followup",
                purchaseId: id,
                patientId: prevData.patientId,
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
      console.error("Error updating medicine purchase:", error);
      throw error;
    }
  },

  /**
   * Create a sales return record for an existing medicine purchase.
   * This keeps the original purchase immutable while tracking adjustments.
   */
  async addMedicinePurchaseReturn(
    purchaseId: string,
    returnData: Omit<MedicinePurchaseReturn, "id" | "createdAt">,
  ): Promise<string> {
    try {
      // Enforced here too, not just in purchase-return.tsx's form
      // validation — `notes` is the mandatory documented reason required
      // per IRD's reversal provisions (see the model comment), and this is
      // currently the only guard against a future/alternate call site
      // bypassing that UI-level check.
      if (!returnData.notes?.trim()) {
        throw new Error("A reason is required to record a return.");
      }

      const purchaseRef = doc(db, MEDICINE_PURCHASES_COLLECTION, purchaseId);

      const medicineItems = returnData.items;

      // Fallback-only lookup (legacy purchase items with no recorded
      // batchAllocations) — the real, batch-accurate stock refs are
      // resolved inside the transaction below, once the original
      // purchase's per-item batchAllocations are known.
      const fallbackStockRefs: Record<string, any> = {};

      for (const item of medicineItems) {
        const q = query(
          collection(db, "medicineStock"),
          where("medicineId", "==", item.medicineId),
          where("clinicId", "==", returnData.clinicId),
        );
        const snap = await getDocs(q);

        if (!snap.empty) {
          fallbackStockRefs[item.medicineId] = doc(
            db,
            "medicineStock",
            snap.docs[0].id,
          );
        }
      }

      const returnId = await runTransaction(db, async (transaction) => {
        // 1. Read Purchase Document
        const purchaseSnap = await transaction.get(purchaseRef);

        if (!purchaseSnap.exists()) {
          throw new Error("Purchase not found");
        }
        const originalPurchase = purchaseSnap.data() as MedicinePurchase;

        // Calculate already returned quantities to prevent over-returning
        const returnedQuantities = new Map<string, number>();
        const existingReturns = originalPurchase.returns || [];

        existingReturns.forEach((r: any) => {
          r.items?.forEach((i: any) => {
            if (i.purchaseItemId) {
              returnedQuantities.set(
                i.purchaseItemId,
                (returnedQuantities.get(i.purchaseItemId) || 0) + i.quantity,
              );
            }
          });
        });

        // Validate that we aren't returning more than purchased
        for (const item of medicineItems) {
          const alreadyReturned =
            returnedQuantities.get(item.purchaseItemId) || 0;
          const originalItem = originalPurchase.items?.find(
            (i: any) => i.id === item.purchaseItemId,
          );

          if (!originalItem) {
            throw new Error(
              `Original purchase item not found for ${item.medicineName}`,
            );
          }

          if (alreadyReturned + item.quantity > originalItem.quantity) {
            throw new Error(
              `Cannot return ${item.quantity} of ${item.medicineName}. Only ${originalItem.quantity - alreadyReturned} remaining to return.`,
            );
          }
        }

        // 2. Build a restoration plan per returned item: restore quantity
        // to the SPECIFIC batch doc(s) the original sale actually deducted
        // from (recorded as batchAllocations at sale time), instead of
        // whichever medicineStock doc a plain medicineId query happens to
        // return first — otherwise stock can be "returned" into an
        // unrelated (possibly already-expired) batch, corrupting FEFO
        // ordering and expiry tracking even though the medicine's total
        // stock count still ends up numerically correct.
        const restorationPlans: Record<
          string,
          { stockRef: any; quantity: number }[]
        > = {};

        for (const item of medicineItems) {
          const originalItem = originalPurchase.items?.find(
            (i: any) => i.id === item.purchaseItemId,
          );
          const allocations = (originalItem as any)?.batchAllocations as
            | { stockDocId: string; quantity: number }[]
            | undefined;
          const plan: { stockRef: any; quantity: number }[] = [];

          if (allocations && allocations.length > 0) {
            let remaining = item.quantity;

            for (const alloc of allocations) {
              if (remaining <= 0) break;
              const take = Math.min(remaining, alloc.quantity);

              if (take > 0) {
                plan.push({
                  stockRef: doc(db, "medicineStock", alloc.stockDocId),
                  quantity: take,
                });
                remaining -= take;
              }
            }
            // Shouldn't happen given the over-return guard above, but
            // stay safe: any leftover goes onto the last known batch.
            if (remaining > 0 && plan.length > 0) {
              plan[plan.length - 1].quantity += remaining;
            }
          }

          if (plan.length === 0) {
            // Legacy item with no batchAllocations recorded — fall back
            // to whichever medicineStock doc exists for this medicine.
            const fallbackRef = fallbackStockRefs[item.medicineId];

            if (fallbackRef) {
              plan.push({ stockRef: fallbackRef, quantity: item.quantity });
            }
          }

          restorationPlans[item.purchaseItemId] = plan;
        }

        // 3. Read every referenced stock doc (all transactional reads must
        // precede writes) — cached by path since multiple items can share
        // a batch.
        const stockDocCache: Record<string, any> = {};

        for (const plan of Object.values(restorationPlans)) {
          for (const entry of plan) {
            const key = entry.stockRef.path;

            if (!(key in stockDocCache)) {
              const snap = await transaction.get(entry.stockRef);

              stockDocCache[key] = snap.exists() ? snap.data() : null;
            }
          }
        }

        // 3. Prepare data
        const now = Timestamp.now();
        const generatedId = doc(collection(db, "temp")).id;

        const returnRecord: any = {
          id: generatedId,
          clinicId: returnData.clinicId,
          branchId: returnData.branchId || "",
          purchaseId: returnData.purchaseId,
          totalAmount: returnData.totalAmount,
          refundMethod: returnData.refundMethod,
          items: returnData.items.map((item: any) => ({
            id: item.id,
            purchaseItemId: item.purchaseItemId,
            medicineId: item.medicineId,
            medicineName: item.medicineName,
            quantity: item.quantity,
            amount: item.amount,
            ...(item.reason && { reason: item.reason }),
          })),
          createdBy: returnData.createdBy,
          createdAt: now,
          ...(returnData.notes && { notes: returnData.notes }),
        };

        const allReturns = [...existingReturns, returnRecord];
        const totalReturnedAmount = allReturns.reduce(
          (sum, r) => sum + Math.abs(r.totalAmount || 0),
          0,
        );

        // Map for item types
        const purchaseItemTypeMap = new Map<string, string>();

        if (originalPurchase.items) {
          originalPurchase.items.forEach((item: any) => {
            purchaseItemTypeMap.set(item.id, item.type || "medicine");
          });
        }

        // 4. Perform Writes
        // Update Purchase
        transaction.update(purchaseRef, {
          returns: allReturns,
          totalReturnedAmount,
          updatedAt: now,
        });

        // Update Stock and Create Transactions — restore each item's
        // returned quantity to the specific batch doc(s) it was actually
        // sold from (restorationPlans), not just "some" stock doc for the
        // medicine.
        for (const item of medicineItems) {
          const itemType = purchaseItemTypeMap.get(item.purchaseItemId);

          if (itemType !== "medicine" && itemType !== undefined) continue;

          const plan = restorationPlans[item.purchaseItemId] || [];

          for (const entry of plan) {
            const currentStockData = stockDocCache[entry.stockRef.path];

            if (!currentStockData) continue;

            const newStock =
              (currentStockData.currentStock || 0) + entry.quantity;

            transaction.update(entry.stockRef, {
              currentStock: newStock,
              updatedBy: returnData.createdBy,
              updatedAt: now,
            });
            // Keep the cache in sync in case a later plan entry (a
            // different item) touches the same batch doc again in this
            // same transaction.
            currentStockData.currentStock = newStock;

            const logRef = doc(collection(db, "stockTransactions"));

            transaction.set(logRef, {
              medicineId: item.medicineId,
              type: "returned",
              quantity: entry.quantity,
              previousStock: newStock - entry.quantity,
              newStock,
              unitPrice: Math.abs(item.amount / item.quantity),
              totalAmount: Math.abs(
                (item.amount / item.quantity) * entry.quantity,
              ),
              referenceId: originalPurchase.purchaseNo || purchaseId,
              reason: item.reason || "Return from pharmacy sale",
              clinicId: returnData.clinicId,
              branchId: returnData.branchId,
              createdBy: returnData.createdBy,
              createdAt: now,
            });
          }
        }

        return generatedId;
      });

      // Java backend + MySQL is the sole authority for IRD sync (see the
      // matching comment in createMedicinePurchase). Stock has already been
      // restored and the return has already happened by this point, so a
      // sync failure here is logged, not thrown.
      try {
        const purchaseDoc = await getDoc(purchaseRef);

        if (purchaseDoc.exists()) {
          const purchase = purchaseDoc.data() as MedicinePurchase;
          const { billingApi } = await import("./api/billingApi");
          const { getNepaliFiscalYear } = await import("./irdCbmsService");
          const { clinicService } = await import("./clinicService");
          const { computeIdempotencyKey } = await import(
            "../utils/idempotencyKey"
          );
          // IRD's irdEnabled lives on the Clinic document (that's what Clinic
          // Settings > IRD CBMS Configuration actually writes to) — never on
          // ClinicSettings, which has its own same-named but always-unset field.
          const javaClinic = await clinicService.getClinicById(
            returnData.clinicId,
          );
          // Mirror the original sale's taxable/exempt split instead of
          // hardcoding the return as fully exempt — a return of items from
          // a taxed sale must reverse the same proportion of tax, or IRD's
          // reported taxable revenue never actually decreases while the
          // exempt total gets incorrectly inflated.
          const originalTaxRatio =
            (purchase.netAmount || 0) > 0 && (purchase.taxAmount || 0) > 0
              ? (purchase.taxAmount || 0) / (purchase.netAmount || 0)
              : 0;
          const isOriginalTaxable = originalTaxRatio > 0;
          const returnGrossAmount = Math.abs(returnData.totalAmount || 0);
          const returnTaxAmount = isOriginalTaxable
            ? Math.round(returnGrossAmount * originalTaxRatio)
            : 0;
          const returnTaxableAmount = isOriginalTaxable
            ? returnGrossAmount - returnTaxAmount
            : 0;
          const returnExemptAmount = isOriginalTaxable
            ? 0
            : returnGrossAmount;

          const returnItems = returnData.items.map((item) => ({
            itemName: "Return Item",
            quantity: -Math.abs(item.quantity || 1),
            rate: item.amount / item.quantity || 0,
            totalAmount: -Math.abs(item.amount || 0),
            isTaxable: isOriginalTaxable,
          }));
          const payload = {
            firebasePatientId: (purchase as any).patientId || "",
            buyerName: purchase.patientName || "Cash Sales",
            buyerPan: (purchase as any).patientPanVat || "",
            totalAmount: -Math.abs(returnData.totalAmount),
            taxableAmount: -returnTaxableAmount,
            taxAmount: -returnTaxAmount,
            exemptAmount: -returnExemptAmount,
            irdEnabled: Boolean(javaClinic?.irdEnabled),
            fiscalYear: getNepaliFiscalYear(
              purchase.purchaseDate || new Date(),
            ),
            isReturn: true,
            // IRD's /api/billreturn requires these two beyond a normal
            // /api/bill — see IrdCbmsService.buildPayload's isReturn branch.
            // purchase.purchaseNo is the exact value originally sent as this
            // sale's invoice_number (createMedicinePurchase passes it as
            // preAssignedInvoiceNumber), so it's the correct reference here.
            refInvoiceNumber: purchase.purchaseNo,
            reasonForReturn: returnData.notes,
            // Deterministic per-content key — a network-drop retry of this
            // exact submission reuses it, so the backend returns the
            // already-created invoice instead of minting a duplicate.
            idempotencyKey: computeIdempotencyKey({
              clinicId: returnData.clinicId,
              buyerName: purchase.patientName || "Cash Sales",
              totalAmount: -Math.abs(returnData.totalAmount),
              items: returnItems,
            }),
            items: returnItems,
          };

          const result = await billingApi.createInvoice(payload);

          if (result?.id) {
            console.log(
              "Pharmacy return synced to Java backend with ID:",
              result.id,
            );

            // Persist the sync outcome onto the specific return record so it
            // can be audited/retried later — the return lives nested inside
            // the purchase doc's `returns` array, so update it by matching id.
            const updatedReturns = (purchase.returns || []).map((r: any) =>
              r.id === returnId
                ? {
                    ...r,
                    javaInvoiceId: result.id,
                    irdSynced: Boolean(result.irdSynced),
                    cbmsResponseCode: result.cbmsResponseCode || null,
                  }
                : r,
            );

            await updateDoc(purchaseRef, { returns: updatedReturns });
          }
        }
      } catch (javaError: any) {
        console.warn(
          "Java backend submission skipped or offline:",
          javaError.message || javaError,
        );
      }

      return returnId;
    } catch (error) {
      console.error("Error creating medicine purchase return:", error);
      throw error;
    }
  },

  /**
   * Get purchases by payment status
   */
  async getMedicinePurchasesByPaymentStatus(
    clinicId: string,
    paymentStatus: "paid" | "pending" | "partial",
  ): Promise<MedicinePurchase[]> {
    try {
      // clinicId was accepted as a parameter but never actually used to
      // filter — every clinic's purchases matching paymentStatus (and
      // branchId, if given) were being returned. Real cross-tenant leak.
      const purchasesRef = collection(db, MEDICINE_PURCHASES_COLLECTION);
      let q = query(
        purchasesRef,
        where("clinicId", "==", clinicId),
        where("paymentStatus", "==", paymentStatus),
      );


      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((doc) => {
        const data = doc.data();

        return {
          id: doc.id,
          ...data,
          purchaseDate: data.purchaseDate?.toDate(),
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as MedicinePurchase;
      });
    } catch (error) {
      console.error(
        "Error getting medicine purchases by payment status:",
        error,
      );
      throw error;
    }
  },

  // =================== MEDICINE USAGE ===================

  /**
   * Create a new medicine usage record
   */
  async createMedicineUsage(
    usageData: Omit<MedicineUsage, "id" | "createdAt" | "updatedAt">,
  ): Promise<string> {
    try {
      const usageRef = collection(db, MEDICINE_USAGE_COLLECTION);

      const now = Timestamp.now();
      const data = {
        ...usageData,
        createdAt: now,
        updatedAt: now,
      };

      const docRef = await addDoc(usageRef, data);

      console.log("Medicine usage created with ID:", docRef.id);

      return docRef.id;
    } catch (error) {
      console.error("Error creating medicine usage:", error);
      throw error;
    }
  },

  /**
   * Get a medicine usage record by ID
   */
  async getMedicineUsageById(id: string): Promise<MedicineUsage | null> {
    try {
      const docRef = doc(db, MEDICINE_USAGE_COLLECTION, id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();

        return {
          id: docSnap.id,
          ...data,
          usageDate: data.usageDate?.toDate(),
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as MedicineUsage;
      }

      return null;
    } catch (error) {
      console.error("Error getting medicine usage:", error);
      throw error;
    }
  },

  /**
   * Get all medicine usage records for a clinic
   */
  async getMedicineUsageByClinic(
    clinicId: string,
  ): Promise<MedicineUsage[]> {
    try {
      const usageRef = collection(db, MEDICINE_USAGE_COLLECTION);
      let q = query(usageRef, where("clinicId", "==", clinicId));

      // Filter by branch if specified

      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((doc) => {
        const data = doc.data();

        return {
          id: doc.id,
          ...data,
          usageDate: data.usageDate?.toDate(),
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as MedicineUsage;
      });
    } catch (error) {
      console.error("Error getting medicine usage records:", error);
      throw error;
    }
  },

  /**
   * Get medicine usage records for a specific medicine
   */
  async getMedicineUsageByMedicine(
    clinicId: string,
    medicineId: string,
  ): Promise<MedicineUsage[]> {
    try {
      const usageRef = collection(db, MEDICINE_USAGE_COLLECTION);
      let q = query(
        usageRef,
        where("clinicId", "==", clinicId),
        where("medicineId", "==", medicineId),
      );


      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((doc) => {
        const data = doc.data();

        return {
          id: doc.id,
          ...data,
          usageDate: data.usageDate?.toDate(),
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as MedicineUsage;
      });
    } catch (error) {
      console.error("Error getting medicine usage by medicine:", error);
      throw error;
    }
  },

  /**
   * Get medicine usage records for a specific patient
   */
  async getMedicineUsageByPatient(
    clinicId: string,
    patientId: string,
  ): Promise<MedicineUsage[]> {
    try {
      const usageRef = collection(db, MEDICINE_USAGE_COLLECTION);
      let q = query(
        usageRef,
        where("clinicId", "==", clinicId),
        where("patientId", "==", patientId),
      );


      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((doc) => {
        const data = doc.data();

        return {
          id: doc.id,
          ...data,
          usageDate: data.usageDate?.toDate(),
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as MedicineUsage;
      });
    } catch (error) {
      console.error("Error getting medicine usage by patient:", error);
      throw error;
    }
  },

  /**
   * Update a medicine usage record
   */
  async updateMedicineUsage(
    id: string,
    updateData: Partial<Omit<MedicineUsage, "id" | "createdAt" | "updatedAt">>,
  ): Promise<void> {
    try {
      const docRef = doc(db, MEDICINE_USAGE_COLLECTION, id);

      await updateDoc(docRef, {
        ...updateData,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error("Error updating medicine usage:", error);
      throw error;
    }
  },

  /**
   * Delete a medicine usage record
   */
  async deleteMedicineUsage(id: string): Promise<void> {
    try {
      const docRef = doc(db, MEDICINE_USAGE_COLLECTION, id);

      await deleteDoc(docRef);
    } catch (error) {
      console.error("Error deleting medicine usage:", error);
      throw error;
    }
  },

  // =================== REPORTING & ANALYTICS ===================

  /**
   * Get purchase summary for a date range
   */
  async getPurchaseSummary(
    clinicId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{
    totalPurchases: number;
    totalAmount: number;
    totalItems: number;
    averageOrderValue: number;
  }> {
    try {
      const purchases = await this.getMedicinePurchasesByClinic(clinicId);

      const filteredPurchases = purchases.filter(
        (purchase) =>
          purchase.purchaseDate >= startDate &&
          purchase.purchaseDate <= endDate,
      );

      const totalPurchases = filteredPurchases.length;
      const totalAmount = filteredPurchases.reduce(
        (sum, purchase) => sum + purchase.netAmount,
        0,
      );
      const totalItems = filteredPurchases.reduce(
        (sum, purchase) =>
          sum +
          purchase.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
        0,
      );
      const averageOrderValue =
        totalPurchases > 0 ? totalAmount / totalPurchases : 0;

      return {
        totalPurchases,
        totalAmount,
        totalItems,
        averageOrderValue,
      };
    } catch (error) {
      console.error("Error getting purchase summary:", error);
      throw error;
    }
  },

  /**
   * Get usage summary for a date range
   */
  async getUsageSummary(
    clinicId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{
    totalUsageRecords: number;
    totalQuantityUsed: number;
    mostUsedMedicines: Array<{
      medicineId: string;
      medicineName: string;
      totalUsed: number;
    }>;
  }> {
    try {
      const usageRecords = await this.getMedicineUsageByClinic(clinicId);

      const filteredUsage = usageRecords.filter(
        (usage) => usage.usageDate >= startDate && usage.usageDate <= endDate,
      );

      const totalUsageRecords = filteredUsage.length;
      const totalQuantityUsed = filteredUsage.reduce(
        (sum, usage) => sum + usage.quantityUsed,
        0,
      );

      // Calculate most used medicines
      const medicineUsageMap = new Map<
        string,
        { medicineName: string; totalUsed: number }
      >();

      filteredUsage.forEach((usage) => {
        const existing = medicineUsageMap.get(usage.medicineId);

        if (existing) {
          existing.totalUsed += usage.quantityUsed;
        } else {
          medicineUsageMap.set(usage.medicineId, {
            medicineName: usage.medicineName,
            totalUsed: usage.quantityUsed,
          });
        }
      });

      const mostUsedMedicines = Array.from(medicineUsageMap.entries())
        .map(([medicineId, data]) => ({
          medicineId,
          medicineName: data.medicineName,
          totalUsed: data.totalUsed,
        }))
        .sort((a, b) => b.totalUsed - a.totalUsed)
        .slice(0, 10); // Top 10 most used medicines

      return {
        totalUsageRecords,
        totalQuantityUsed,
        mostUsedMedicines,
      };
    } catch (error) {
      console.error("Error getting usage summary:", error);
      throw error;
    }
  },

  // =================== PHARMACY SETTINGS ===================

  /**
   * Get pharmacy settings for a clinic/branch
   */
  async getPharmacySettings(
    clinicId: string,
  ): Promise<PharmacySettings | null> {
    try {
      const settingsRef = collection(db, PHARMACY_SETTINGS_COLLECTION);
      let q = query(settingsRef, where("clinicId", "==", clinicId));


      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        const data = doc.data();

        return {
          ...data,
          id: doc.id,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as PharmacySettings;
      }

      return null;
    } catch (error) {
      console.error("Error getting pharmacy settings:", error);
      throw error;
    }
  },

  /**
   * Create or update pharmacy settings
   */
  async savePharmacySettings(
    settingsData: Omit<PharmacySettings, "id" | "createdAt" | "updatedAt">,
  ): Promise<string> {
    try {
      // Check if settings already exist
      const existingSettings = await this.getPharmacySettings(
        settingsData.clinicId,
        settingsData.branchId,
      );

      const now = Timestamp.now();

      if (existingSettings) {
        // Update existing settings
        const docRef = doc(
          db,
          PHARMACY_SETTINGS_COLLECTION,
          existingSettings.id,
        );

        await updateDoc(docRef, {
          ...settingsData,
          updatedAt: now,
        });

        return existingSettings.id;
      } else {
        // Create new settings with deterministic ID so future look-ups are cheap
        const docId = settingsData.branchId
          ? `${settingsData.clinicId}_${settingsData.branchId}`
          : settingsData.clinicId;
        const docRef = doc(db, PHARMACY_SETTINGS_COLLECTION, docId);
        const data = {
          ...settingsData,
          id: docId,
          createdAt: now,
          updatedAt: now,
        };

        await setDoc(docRef, data);
        console.log("Pharmacy settings created with ID:", docRef.id);

        return docRef.id;
      }
    } catch (error) {
      console.error("Error saving pharmacy settings:", error);
      throw error;
    }
  },

  /**
   * Get default pharmacy settings for new clinics
   */
  getDefaultPharmacySettings(): PharmacySettings {
    const defaultPaymentMethods: PaymentMethod[] = [
      {
        id: "cash",
        name: "Cash",
        key: "cash",
        isEnabled: true,
        requiresReference: false,
        icon: "💵",
        description: "Cash payment",
        isCustom: false,
        createdAt: new Date(),
      },
      {
        id: "card",
        name: "Credit/Debit Card",
        key: "card",
        isEnabled: true,
        requiresReference: true,
        icon: "💳",
        description: "Credit or debit card payment",
        isCustom: false,
        createdAt: new Date(),
      },
      {
        id: "bank_transfer",
        name: "Bank Transfer",
        key: "bank_transfer",
        isEnabled: true,
        requiresReference: true,
        icon: "🏦",
        description: "Bank transfer or wire payment",
        isCustom: false,
        createdAt: new Date(),
      },
      {
        id: "mobile_banking",
        name: "Mobile Banking",
        key: "mobile_banking",
        isEnabled: true,
        requiresReference: true,
        icon: "📱",
        description: "Mobile banking apps (eSewa, Khalti, etc.)",
        isCustom: false,
        createdAt: new Date(),
      },
    ];

    return {
      id: "",
      clinicId: "",
      branchId: "",
      // Tax Configuration
      defaultTaxPercentage: 13, // Default VAT in Nepal
      enableTax: true,
      taxLabel: "VAT",

      // Payment Methods Configuration
      enabledPaymentMethods: defaultPaymentMethods,
      defaultPaymentMethod: "cash",

      // Other Settings
      enableDiscount: true,
      defaultDiscountPercentage: 0,
      invoicePrefix: "INV",
      nextInvoiceNumber: 1001,

      // Metadata
      createdAt: new Date(),
      updatedAt: new Date(),
      updatedBy: "",
    };
  },

  // Helper function to generate unique key from name
  generatePaymentMethodKey(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "") // Remove special characters
      .replace(/\s+/g, "_") // Replace spaces with underscores
      .substring(0, 20); // Limit length
  },

  // Add a new custom payment method
  async addPaymentMethod(
    clinicId: string,
    paymentMethodData: Omit<
      PaymentMethod,
      "id" | "key" | "isCustom" | "createdAt"
    >,
  ): Promise<string> {
    try {
      const id = doc(collection(db, "temp")).id; // Generate unique ID
      const key = this.generatePaymentMethodKey(paymentMethodData.name);

      const newPaymentMethod: PaymentMethod = {
        ...paymentMethodData,
        id,
        key,
        isCustom: true,
        createdAt: new Date(),
      };

      // Get current settings or create default ones
      let currentSettings = await this.getPharmacySettings(clinicId);

      if (!currentSettings) {
        // Create default settings if they don't exist
        const defaultSettings = this.getDefaultPharmacySettings();
        const settingsData = {
          ...defaultSettings,
          clinicId,
          branchId: clinicId || "",
          updatedBy: "", // Will be set by the caller
        };

        // Save default settings first
        await this.savePharmacySettings(settingsData);

        // Get the newly created settings
        currentSettings = await this.getPharmacySettings(clinicId);

        if (!currentSettings) {
          throw new Error("Failed to create default pharmacy settings");
        }
      }

      // Check if key already exists
      const keyExists = currentSettings.enabledPaymentMethods.some(
        (pm) => pm.key === key,
      );

      if (keyExists) {
        throw new Error("A payment method with this name already exists");
      }

      // Add to existing payment methods
      const updatedSettings: Omit<
        PharmacySettings,
        "id" | "createdAt" | "updatedAt"
      > = {
        ...currentSettings,
        enabledPaymentMethods: [
          ...currentSettings.enabledPaymentMethods,
          newPaymentMethod,
        ],
      };

      await this.savePharmacySettings(updatedSettings);

      return id;
    } catch (error) {
      console.error("Error adding payment method:", error);
      throw error;
    }
  },

  // Update an existing payment method
  async updatePaymentMethod(
    clinicId: string,
    paymentMethodId: string,
    updates: Partial<Omit<PaymentMethod, "id" | "isCustom" | "createdAt">>,
  ): Promise<void> {
    try {
      const currentSettings = await this.getPharmacySettings(clinicId);

      if (!currentSettings) {
        throw new Error(
          "Pharmacy settings not found. Please save settings first.",
        );
      }

      const updatedPaymentMethods = currentSettings.enabledPaymentMethods.map(
        (pm) => {
          if (pm.id === paymentMethodId) {
            const updatedMethod = { ...pm, ...updates };

            // If name is being updated, regenerate key
            if (updates.name && updates.name !== pm.name) {
              updatedMethod.key = this.generatePaymentMethodKey(updates.name);
            }

            return updatedMethod;
          }

          return pm;
        },
      );

      const updatedSettings: Omit<
        PharmacySettings,
        "id" | "createdAt" | "updatedAt"
      > = {
        ...currentSettings,
        enabledPaymentMethods: updatedPaymentMethods,
      };

      await this.savePharmacySettings(updatedSettings);
    } catch (error) {
      console.error("Error updating payment method:", error);
      throw error;
    }
  },

  // Delete a payment method
  async deletePaymentMethod(
    clinicId: string,
    paymentMethodId: string,
  ): Promise<void> {
    try {
      const currentSettings = await this.getPharmacySettings(clinicId);

      if (!currentSettings) {
        throw new Error(
          "Pharmacy settings not found. Please save settings first.",
        );
      }

      // Find the payment method to delete
      const paymentMethodToDelete = currentSettings.enabledPaymentMethods.find(
        (pm) => pm.id === paymentMethodId,
      );

      if (!paymentMethodToDelete) {
        throw new Error("Payment method not found");
      }

      // Don't allow deleting non-custom payment methods
      if (!paymentMethodToDelete.isCustom) {
        throw new Error("Cannot delete default payment methods");
      }

      // Remove from payment methods array
      const updatedPaymentMethods =
        currentSettings.enabledPaymentMethods.filter(
          (pm) => pm.id !== paymentMethodId,
        );

      // If this was the default payment method, set a new default
      let newDefaultPaymentMethod = currentSettings.defaultPaymentMethod;

      if (currentSettings.defaultPaymentMethod === paymentMethodToDelete.key) {
        const enabledMethod = updatedPaymentMethods.find((pm) => pm.isEnabled);

        newDefaultPaymentMethod = enabledMethod ? enabledMethod.key : "cash";
      }

      const updatedSettings: Omit<
        PharmacySettings,
        "id" | "createdAt" | "updatedAt"
      > = {
        ...currentSettings,
        enabledPaymentMethods: updatedPaymentMethods,
        defaultPaymentMethod: newDefaultPaymentMethod,
      };

      await this.savePharmacySettings(updatedSettings);
    } catch (error) {
      console.error("Error deleting payment method:", error);
      throw error;
    }
  },
};

export default pharmacyService;
