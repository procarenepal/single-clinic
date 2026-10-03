/**
 * Issuing one invoice that also dispenses medicine.
 *
 * Why this is not just another call to appointmentBillingService.createBilling:
 * that path calls the Java ledger first and writes Firestore second, which is
 * correct precisely because nothing irreversible has happened yet — if the
 * ledger call fails, nothing was given away. A bill that dispenses medicine
 * breaks that assumption. Stock leaving the shelf cannot be undone, so it must
 * not depend on a network call succeeding, and the sale must still reach IRD
 * even if that call fails.
 *
 * So a dispensing bill uses the shape pharmacy already proved: reserve the
 * number from the shared gapless sequence, then commit the stock deduction,
 * the invoice document and a durable outbox entry in ONE Firestore
 * transaction, and only then attempt the ledger call. If that attempt fails,
 * the backend's outbox poller files the sale later; the outbox never touches
 * stock, so draining it cannot double-deduct, and the payload's
 * preAssignedInvoiceNumber means a retry resolves to the same ledger row
 * instead of a second one.
 *
 * Bills with no medicine on them keep using createBilling unchanged — paying
 * the cost of this flow when nothing irreversible happens would be a
 * regression, not a safety measure.
 */

import {
  collection,
  doc,
  getDocs,
  increment,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "../config/firebase";
import { AppointmentBilling, AppointmentBillingItem } from "../types/models";

import {
  planStockDeduction,
  planStockRestoration,
  StockBatch,
} from "./core/stockFefoCore";
import {
  assertOnline,
  resolveInvoicePrefix,
} from "./core/billingLifecycleCore";

const APPOINTMENT_BILLING_COLLECTION = "appointmentBilling";
const BILLING_SYNC_OUTBOX_COLLECTION = "billingSyncOutbox";
const MEDICINE_STOCK_COLLECTION = "medicineStock";

/**
 * Does this invoice take anything off the shelf?
 *
 * A credit note must answer false even though it carries the original's
 * medicine lines. buildCreditNoteSkeleton negates price and amount but leaves
 * quantity positive, so a plain "medicine line with quantity > 0" test reads a
 * reversal as a fresh dispense and would take the stock a SECOND time instead
 * of putting it back. A reversal is recognised by its negated amount.
 */
export function hasDispensableLines(items: AppointmentBillingItem[]): boolean {
  return items.some(
    (item) =>
      item.lineKind === "medicine" &&
      item.quantity > 0 &&
      (item.amount ?? 0) >= 0 &&
      (item.price ?? 0) >= 0,
  );
}

export interface DispensingBillResult {
  id: string;
  invoiceNumber: string;
  /** False when the ledger call failed and the outbox will file it instead. */
  filedImmediately: boolean;
}

/**
 * Create an invoice that dispenses medicine.
 *
 * `billingData.items` may mix service, lab and medicine lines. Medicine lines
 * are repriced from the batches they actually come out of — a batch bought in
 * at a different price sells at that price — so the stored invoice can differ
 * from what the screen showed. That is the same rule pharmacy applies, and the
 * batch-resolved figure is the one that reaches IRD.
 */
export async function createDispensingBill(
  billingData: Omit<AppointmentBilling, "id" | "createdAt" | "updatedAt">,
): Promise<DispensingBillResult> {
  assertOnline();

  const { billingApi, buildInvoicePayload } = await import("./api/billingApi");
  const { getNepaliFiscalYear } = await import("./irdCbmsService");
  const { clinicService } = await import("./clinicService");
  const { appointmentBillingService } = await import(
    "./appointmentBillingService"
  );

  const clinicId = billingData.clinicId;
  const fiscalYear = getNepaliFiscalYear(billingData.invoiceDate || new Date());

  const settings = await appointmentBillingService
    .getBillingSettings(clinicId)
    .catch(() => null);
  const clinic = await clinicService.getClinicById(clinicId).catch(() => null);

  // Reserved BEFORE the transaction, from the same Java sequence every other
  // invoice draws on, so this bill interleaves into the one gapless series IRD
  // expects. Done first because the transaction below is irreversible once it
  // commits and must not depend on the backend still answering.
  const invoiceNumber = await billingApi.reserveInvoiceNumber({
    fiscalYear,
    prefix: resolveInvoicePrefix(false, settings?.invoicePrefix),
  });

  const medicineLines = billingData.items.filter(
    (item) => item.lineKind === "medicine" && item.quantity > 0,
  );
  const medicineIds = Array.from(
    new Set(medicineLines.map((line) => line.appointmentTypeId)),
  );

  // A Firestore transaction cannot run queries, so the batch documents are
  // located now and re-read for consistency inside it.
  const batchRefsByMedicine: Record<string, { id: string; docRef: any }[]> = {};

  for (const medicineId of medicineIds) {
    const snap = await getDocs(
      query(
        collection(db, MEDICINE_STOCK_COLLECTION),
        where("medicineId", "==", medicineId),
        where("clinicId", "==", clinicId),
      ),
    );

    batchRefsByMedicine[medicineId] = snap.docs.map((d) => ({
      id: d.id,
      docRef: d.ref,
    }));
  }

  const billingRef = doc(collection(db, APPOINTMENT_BILLING_COLLECTION));

  const committed = await runTransaction(db, async (transaction) => {
    // 1. Re-read every batch inside the transaction.
    const batchesByMedicine: Record<string, (StockBatch & { docRef: any })[]> =
      {};

    for (const medicineId of medicineIds) {
      const loaded: (StockBatch & { docRef: any })[] = [];

      for (const ref of batchRefsByMedicine[medicineId] || []) {
        const snap = await transaction.get(ref.docRef);

        if (snap.exists()) {
          loaded.push({ id: ref.id, docRef: ref.docRef, data: snap.data() });
        }
      }

      batchesByMedicine[medicineId] = loaded;
    }

    // 2. Decide the allocations. Shared with pharmacy so expiry, FEFO order,
    //    scheme stock and per-batch pricing are decided in exactly one place.
    const stockWrites: { docRef: any; data: any }[] = [];
    const stockLogs: any[] = [];
    const parentTotals: Record<
      string,
      { regularQty: number; schemeQty: number }
    > = {};

    const repricedItems = billingData.items.map((item) => {
      if (item.lineKind !== "medicine" || item.quantity <= 0) return item;

      const batches = batchesByMedicine[item.appointmentTypeId] || [];
      const plan = planStockDeduction(
        {
          medicineName: item.appointmentTypeName,
          quantity: item.quantity,
          // Scheme stock is a separate pool at a separate price, so the line
          // has to say which one it came off.
          stockType: item.stockType || "regular",
          fallbackPrice: item.price,
        },
        batches,
      );

      const batchById = new Map(batches.map((b) => [b.id, b]));

      for (const alloc of plan.allocations) {
        const batch = batchById.get(alloc.stockDocId)!;

        if (!parentTotals[item.appointmentTypeId]) {
          parentTotals[item.appointmentTypeId] = {
            regularQty: 0,
            schemeQty: 0,
          };
        }
        if (alloc.isSchemeStock) {
          parentTotals[item.appointmentTypeId].schemeQty += alloc.qty;
        } else {
          parentTotals[item.appointmentTypeId].regularQty += alloc.qty;
        }

        stockWrites.push({
          docRef: batch.docRef,
          data: {
            currentStock: alloc.newRegularStock,
            schemeStock: alloc.newSchemeStock,
            updatedBy: billingData.createdBy,
            updatedAt: serverTimestamp(),
          },
        });

        stockLogs.push({
          medicineId: item.appointmentTypeId,
          type: "sale",
          quantity: alloc.qty,
          previousStock: alloc.previousStock,
          newStock: alloc.newStock,
          isSchemeStock: alloc.isSchemeStock,
          salePrice: alloc.price,
          unitPrice: alloc.price,
          totalAmount: alloc.price * alloc.qty,
          batchNumber: alloc.batchNumber,
          expiryDate: alloc.expiryDate ?? null,
          referenceId: invoiceNumber,
          clinicId,
          branchId: billingData.branchId || "",
          createdBy: billingData.createdBy,
        });
      }

      // Reprice the line from the batches it actually came out of, and record
      // which those were so a later return can put the stock back where it
      // came from rather than guessing.
      const gross = plan.totalAmount;
      const discountAmount = Math.min(
        item.discountType === "percent"
          ? (gross * (item.discountValue || 0)) / 100
          : item.discountValue || 0,
        gross,
      );

      return {
        ...item,
        price: item.quantity > 0 ? gross / item.quantity : item.price,
        discountAmount,
        amount: gross - discountAmount,
        // Named batchAllocations to match what pharmacy already persists, so
        // one restoration helper can put stock back for a credit note here and
        // for a pharmacy return there. {stockDocId, quantity} is the part the
        // restore reads; the rest is for display on the invoice.
        batchAllocations: plan.allocations.map((a) => ({
          stockDocId: a.stockDocId,
          quantity: a.qty,
          batchNumber: a.batchNumber,
          price: a.price,
          expiryDate: a.expiryDate ?? null,
          isSchemeStock: a.isSchemeStock,
        })),
      } as AppointmentBillingItem;
    });

    // 3. Recompute the invoice from the repriced lines, through the same
    //    engine the screen used, so the stored totals and the figures filed
    //    with IRD agree with the lines actually billed.
    const totals = appointmentBillingService.calculateInvoiceTotals(
      repricedItems,
      billingData.discountType || "flat",
      billingData.discountValue || 0,
      billingData.taxPercentage || 0,
    );

    // Firestore rejects an explicit `undefined`, and a bill assembled by the
    // counter is full of them: a lab or medicine line has no doctorId,
    // doctorName or taxRate, and those are set to undefined rather than left
    // out. createBilling survives it because it deep-cleans first, so this
    // path has to as well — and inside a transaction that already plans a
    // stock deduction, an undefined value would fail the whole sale.
    const cleaned = appointmentBillingService.deepClean({
      ...billingData,
      items: repricedItems,
    });

    transaction.set(billingRef, {
      ...cleaned,
      invoiceNumber,
      subtotal: totals.subtotal,
      discountAmount: totals.totalDiscount,
      itemDiscountAmount: totals.itemDiscountAmount,
      mainDiscountAmount: totals.mainDiscountAmount,
      taxableAmount: totals.taxableAmount,
      exemptAmount: totals.exemptAmount,
      taxAmount: totals.taxAmount,
      totalAmount: totals.totalAmount,
      balanceAmount: totals.totalAmount - (billingData.paidAmount || 0),
      irdSynced: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // 4. The durable record that this sale still has to reach the ledger,
    //    written inside the same transaction as the stock deduction. Once that
    //    commits the sale has happened, so the obligation to file it must be
    //    just as durable.
    const outboxRef = doc(collection(db, BILLING_SYNC_OUTBOX_COLLECTION));
    const payload = buildInvoicePayload({
      clinicId,
      patientId: billingData.patientId,
      patientName: billingData.patientName,
      patientPanVat: billingData.patientPanVat,
      totalAmount: totals.totalAmount,
      taxableAmount: totals.taxableAmount,
      taxAmount: totals.taxAmount,
      exemptAmount: totals.exemptAmount,
      discountAmount: totals.totalDiscount,
      paymentMethod: billingData.paymentMethod,
      irdEnabled: Boolean((clinic as any)?.irdEnabled),
      fiscalYear,
      preAssignedInvoiceNumber: invoiceNumber,
      sourceCollection: APPOINTMENT_BILLING_COLLECTION,
      sourceDocId: billingRef.id,
      items: repricedItems.map((item) => ({
        itemName: item.appointmentTypeName || "Item",
        quantity: item.quantity || 1,
        rate: item.quantity ? item.amount / item.quantity : item.amount,
        totalAmount: item.amount || 0,
        isTaxable: item.isTaxable === true,
      })),
    });

    transaction.set(outboxRef, {
      id: outboxRef.id,
      // buildInvoicePayload leaves optional fields undefined and Firestore
      // rejects undefined outright — which, inside this transaction, would
      // fail the entire sale. The payload is plain JSON, so round-tripping it
      // is a safe way to drop them.
      payload: JSON.parse(JSON.stringify(payload)),
      clinicId,
      status: "pending",
      attempts: 0,
      lastError: null,
      sourceCollection: APPOINTMENT_BILLING_COLLECTION,
      sourceDocId: billingRef.id,
      invoiceNumber,
      createdAt: serverTimestamp(),
      nextAttemptAt: serverTimestamp(),
    });

    // 5. Apply the stock movement itself, last, so a failure above leaves the
    //    shelf untouched.
    for (const [medicineId, qty] of Object.entries(parentTotals)) {
      const updates: any = {};

      if (qty.regularQty > 0) updates.totalStock = increment(-qty.regularQty);
      if (qty.schemeQty > 0) {
        updates.totalSchemeStock = increment(-qty.schemeQty);
      }
      if (Object.keys(updates).length > 0) {
        transaction.update(
          doc(collection(db, "medicines"), medicineId),
          updates,
        );
      }
    }

    for (const write of stockWrites) {
      transaction.update(write.docRef, write.data);
    }

    for (const log of stockLogs) {
      transaction.set(doc(collection(db, "stockTransactions")), {
        ...log,
        createdAt: serverTimestamp(),
      });
    }

    return { outboxId: outboxRef.id, payload };
  });

  // The sale is now durable either way. Try to file it immediately so the
  // invoice shows its ledger id straight away; the outbox is the fallback, not
  // the normal path.
  try {
    const result = await billingApi.createInvoice({
      ...committed.payload,
      preAssignedInvoiceNumber: invoiceNumber,
    } as any);

    // irdSynced/irdSyncDate/cbmsResponseCode are written by the backend's
    // Firestore mirror, never asserted from here.
    await updateDoc(billingRef, { javaInvoiceId: result.id }).catch(() => {});
    await updateDoc(
      doc(db, BILLING_SYNC_OUTBOX_COLLECTION, committed.outboxId),
      {
        status: "done",
        javaInvoiceId: result.id,
        attempts: 1,
        lastError: null,
      },
    ).catch(() => {});

    return { id: billingRef.id, invoiceNumber, filedImmediately: true };
  } catch (error: any) {
    // Deliberately not rethrown: the stock is gone and the invoice exists, so
    // failing the call here would tell staff the sale did not happen when it
    // did. The outbox entry stays pending and the backend poller files it.
    console.error(
      `Invoice ${invoiceNumber} was committed but could not be filed yet — left queued for the backend poller:`,
      error,
    );
    await updateDoc(
      doc(db, BILLING_SYNC_OUTBOX_COLLECTION, committed.outboxId),
      { lastError: error?.message || String(error) },
    ).catch(() => {});

    return { id: billingRef.id, invoiceNumber, filedImmediately: false };
  }
}

/**
 * Issue a credit note for an invoice that dispensed medicine, putting the
 * stock back.
 *
 * The ordinary credit-note path reverses the money by creating a negated
 * invoice, which is the whole job when the original sold services or lab
 * tests. It is not the whole job once medicine is on the bill: reversing the
 * charge while the stock stays gone leaves the shelf understated for good, and
 * no later stock count can tell that apart from theft.
 *
 * Shaped like createDispensingBill and for the same reason — the stock
 * movement is irreversible, so it is committed together with the credit note
 * and its outbox entry in one transaction, and filed with IRD afterwards.
 * Quantity goes back to the exact batches the sale drew it from; see
 * planStockRestoration for why that matters.
 */
export async function createDispensingCreditNote(
  original: AppointmentBilling,
  options: { reason: string; createdBy: string },
): Promise<DispensingBillResult> {
  assertOnline();

  const { billingApi, buildInvoicePayload } = await import("./api/billingApi");
  const { getNepaliFiscalYear } = await import("./irdCbmsService");
  const { clinicService } = await import("./clinicService");
  const { appointmentBillingService } = await import(
    "./appointmentBillingService"
  );
  const { buildCreditNoteSkeleton } = await import(
    "./core/billingLifecycleCore"
  );

  const clinicId = original.clinicId;
  // A credit note belongs to the period of the invoice it reverses, not to
  // today — filing it against the current year would alter tax semantics.
  const fiscalYear = getNepaliFiscalYear(original.invoiceDate || new Date());
  const clinic = await clinicService.getClinicById(clinicId).catch(() => null);

  const creditNote = buildCreditNoteSkeleton(original, {
    reason: options.reason,
    createdBy: options.createdBy,
    extraNegatedFields: ["itemDiscountAmount", "mainDiscountAmount"],
  });

  const creditNoteItems: AppointmentBillingItem[] = creditNote.items || [];
  const medicineLines = creditNoteItems.filter(
    (item) => item.lineKind === "medicine" && item.quantity > 0,
  );

  // Every medicine line this path can be handed was written by
  // createDispensingBill, which always records its allocations. Refuse rather
  // than reverse the money and quietly leave the stock wrong.
  const unrecorded = medicineLines.filter(
    (item) =>
      planStockRestoration(item.quantity, item.batchAllocations).length === 0,
  );

  if (unrecorded.length > 0) {
    const names = unrecorded.map((i) => i.appointmentTypeName).join(", ");

    throw new Error(
      "Cannot credit this invoice automatically: " +
        names +
        " has no record of which stock batches it was dispensed from, so the " +
        "quantity cannot be returned to the right batch. Reverse it through " +
        "the Pharmacy returns flow instead.",
    );
  }

  const invoiceNumber = await billingApi.reserveInvoiceNumber({
    fiscalYear,
    prefix: resolveInvoicePrefix(true, undefined),
  });

  const creditNoteRef = doc(collection(db, APPOINTMENT_BILLING_COLLECTION));

  const committed = await runTransaction(db, async (transaction) => {
    // Addressed straight by document id from the recorded allocations, so
    // unlike a sale this needs no query to locate the batches.
    const restorations: Array<{
      item: AppointmentBillingItem;
      docRef: any;
      quantity: number;
      isSchemeStock: boolean;
      data: any;
    }> = [];

    for (const item of medicineLines) {
      const planned = planStockRestoration(
        item.quantity,
        item.batchAllocations,
      );

      for (const r of planned) {
        const docRef = doc(db, MEDICINE_STOCK_COLLECTION, r.stockDocId);
        const snap = await transaction.get(docRef);

        if (!snap.exists()) continue;

        restorations.push({
          item,
          docRef,
          quantity: r.quantity,
          isSchemeStock: r.isSchemeStock,
          data: snap.data(),
        });
      }
    }

    const cleaned = appointmentBillingService.deepClean({
      ...creditNote,
      invoiceNumber,
    });

    transaction.set(creditNoteRef, {
      ...cleaned,
      irdSynced: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const outboxRef = doc(collection(db, BILLING_SYNC_OUTBOX_COLLECTION));
    const payload = buildInvoicePayload({
      clinicId,
      patientId: original.patientId,
      patientName: original.patientName,
      patientPanVat: original.patientPanVat,
      totalAmount: creditNote.totalAmount,
      taxableAmount: creditNote.taxableAmount,
      taxAmount: creditNote.taxAmount,
      exemptAmount: creditNote.exemptAmount,
      discountAmount: creditNote.discountAmount,
      paymentMethod: original.paymentMethod,
      irdEnabled: Boolean((clinic as any)?.irdEnabled),
      fiscalYear,
      // Routes the filing to IRD's /api/billreturn rather than /api/bill.
      isReturn: true,
      refInvoiceNumber: original.invoiceNumber,
      reasonForReturn: options.reason,
      preAssignedInvoiceNumber: invoiceNumber,
      sourceCollection: APPOINTMENT_BILLING_COLLECTION,
      sourceDocId: creditNoteRef.id,
      items: creditNoteItems.map((item) => ({
        itemName: item.appointmentTypeName || "Item",
        quantity: -Math.abs(item.quantity || 1),
        rate: Math.abs((item.amount || 0) / (item.quantity || 1)),
        totalAmount: -Math.abs(item.amount || 0),
        isTaxable: item.isTaxable === true,
      })),
    });

    transaction.set(outboxRef, {
      id: outboxRef.id,
      payload: JSON.parse(JSON.stringify(payload)),
      clinicId,
      status: "pending",
      attempts: 0,
      lastError: null,
      sourceCollection: APPOINTMENT_BILLING_COLLECTION,
      sourceDocId: creditNoteRef.id,
      invoiceNumber,
      createdAt: serverTimestamp(),
      nextAttemptAt: serverTimestamp(),
    });

    // The stock movement itself, last, so a failure above leaves it untouched.
    const parentTotals: Record<
      string,
      { regularQty: number; schemeQty: number }
    > = {};

    for (const r of restorations) {
      const medicineId = r.item.appointmentTypeId;

      if (!parentTotals[medicineId]) {
        parentTotals[medicineId] = { regularQty: 0, schemeQty: 0 };
      }
      if (r.isSchemeStock) {
        parentTotals[medicineId].schemeQty += r.quantity;
      } else {
        parentTotals[medicineId].regularQty += r.quantity;
      }

      // Scheme stock returns to the scheme pool. Pharmacy's own returns flow
      // always credits currentStock, which silently moves doctor-received
      // stock into bought stock; this path does not repeat that.
      const pool = r.isSchemeStock ? "schemeStock" : "currentStock";
      const before = r.data[pool] ?? 0;
      const after = before + r.quantity;

      transaction.update(r.docRef, {
        [pool]: after,
        updatedBy: options.createdBy,
        updatedAt: serverTimestamp(),
      });
      // Keep the working copy current in case two lines of this same credit
      // note return to the same batch document.
      r.data[pool] = after;

      const unit = Math.abs((r.item.amount || 0) / (r.item.quantity || 1));

      transaction.set(doc(collection(db, "stockTransactions")), {
        medicineId,
        type: "returned",
        quantity: r.quantity,
        previousStock: before,
        newStock: after,
        isSchemeStock: r.isSchemeStock,
        unitPrice: unit,
        totalAmount: unit * r.quantity,
        batchNumber: r.data.batchNumber || "DEFAULT",
        referenceId: invoiceNumber,
        reason: options.reason,
        clinicId,
        branchId: original.branchId || "",
        createdBy: options.createdBy,
        createdAt: serverTimestamp(),
      });
    }

    for (const [medicineId, qty] of Object.entries(parentTotals)) {
      const updates: any = {};

      if (qty.regularQty > 0) updates.totalStock = increment(qty.regularQty);
      if (qty.schemeQty > 0) {
        updates.totalSchemeStock = increment(qty.schemeQty);
      }
      if (Object.keys(updates).length > 0) {
        transaction.update(
          doc(collection(db, "medicines"), medicineId),
          updates,
        );
      }
    }

    return { outboxId: outboxRef.id, payload };
  });

  try {
    const result = await billingApi.createInvoice({
      ...committed.payload,
      preAssignedInvoiceNumber: invoiceNumber,
    } as any);

    await updateDoc(creditNoteRef, { javaInvoiceId: result.id }).catch(
      () => {},
    );

    return { id: creditNoteRef.id, invoiceNumber, filedImmediately: true };
  } catch (error: any) {
    // Not rethrown: the stock is already back and the credit note exists, so
    // failing here would tell staff the reversal did not happen when it did.
    console.error(
      "Credit note " +
        invoiceNumber +
        " was committed but could not be filed yet — left queued for the backend poller:",
      error,
    );
    await updateDoc(
      doc(db, BILLING_SYNC_OUTBOX_COLLECTION, committed.outboxId),
      { lastError: error?.message || String(error) },
    ).catch(() => {});

    return { id: creditNoteRef.id, invoiceNumber, filedImmediately: false };
  }
}
