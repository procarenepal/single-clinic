package com.procaresoft.billing.service;

import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.SetOptions;
import com.google.firebase.cloud.FirestoreClient;
import com.procaresoft.billing.model.Invoice;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;

/**
 * The single place the backend is permitted to WRITE Firestore.
 *
 * Why it exists: the IRD retry scheduler updates MySQL when a sync finally
 * succeeds, but had no way to tell Firestore — so the app went on showing
 * "Failed" forever on invoices IRD had actually accepted. The ledger was
 * right and the screen was wrong, with nothing to reconcile them.
 *
 * Deliberately narrow:
 *  - It writes ONLY the IRD sync-state fields, merged onto an existing
 *    document. It never creates documents and never touches money, items,
 *    patients or anything else.
 *  - It addresses the document through the ledger row's own
 *    source_collection/source_doc_id pointer. A row without a pointer is
 *    skipped, never guessed at by invoice number — guessing which collection
 *    a number belongs to is exactly how a mirror writes to the wrong record.
 *  - It can be switched off entirely via billing.firestore-mirror.enabled.
 *
 * Firestore writes here go through the Admin SDK, which bypasses security
 * rules by design — that is what lets the client lose write access to these
 * fields while the backend keeps it.
 */
@Service
public class FirestoreMirrorService {

    private static final Logger log = LoggerFactory.getLogger(FirestoreMirrorService.class);

    /** The only fields this service is ever allowed to write. */
    private static final String F_IRD_SYNCED = "irdSynced";
    private static final String F_IRD_SYNC_DATE = "irdSyncDate";
    private static final String F_CBMS_RESPONSE_CODE = "cbmsResponseCode";
    private static final String F_NEEDS_REVIEW = "irdNeedsManualReview";
    private static final String F_STATE_AS_OF = "irdStateAsOf";
    private static final String F_STATE_SOURCE = "irdStateSource";

    private final AuditLogService auditLogService;

    @Value("${billing.firestore-mirror.enabled:true}")
    private boolean enabled;

    public FirestoreMirrorService(AuditLogService auditLogService) {
        this.auditLogService = auditLogService;
    }

    /**
     * Push this invoice's IRD sync state onto the Firestore document it was
     * created from.
     *
     * Never throws: mirroring is a display concern. The ledger entry and the
     * IRD filing are the records that legally matter and are already durable
     * by the time this runs, so a Firestore outage must not roll back or fail
     * the sync that just succeeded.
     *
     * @return true if a write was actually made
     */
    public boolean mirrorSyncState(Invoice invoice) {
        if (!enabled) {
            return false;
        }
        if (invoice == null) {
            return false;
        }

        String collection = invoice.getSourceCollection();
        String docId = invoice.getSourceDocId();

        if (collection == null || collection.isBlank() || docId == null || docId.isBlank()) {
            // Expected for every row created before the source pointer
            // existed, and permanently for the rows whose Firestore documents
            // were wiped. Debug, not warn — this is not an error condition.
            log.debug("No source pointer on invoice {} — nothing to mirror", invoice.getInvoiceNumber());
            return false;
        }

        try {
            Firestore firestore = FirestoreClient.getFirestore();

            Map<String, Object> patch = new HashMap<>();
            patch.put(F_IRD_SYNCED, invoice.isIrdSynced());
            patch.put(F_IRD_SYNC_DATE, invoice.getIrdSyncDate() != null
                    ? invoice.getIrdSyncDate().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)
                    : null);
            patch.put(F_CBMS_RESPONSE_CODE, invoice.getCbmsResponseCode());
            patch.put(F_NEEDS_REVIEW, invoice.isIrdNeedsManualReview());
            // Marks this state as backend-authored, so a reader can tell a
            // mirrored value from one the client wrote itself.
            patch.put(F_STATE_AS_OF, java.time.LocalDateTime.now()
                    .format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
            patch.put(F_STATE_SOURCE, "java");

            // merge() so the document's own business data is untouched — this
            // is a patch of six fields, not a document replacement.
            firestore.collection(collection)
                    .document(docId)
                    .set(patch, SetOptions.merge())
                    .get();

            auditLogService.record("Invoice", invoice.getId(), "MIRROR",
                    "system", invoice.getClinicId(),
                    "Mirrored IRD state of " + invoice.getInvoiceNumber()
                            + " (synced=" + invoice.isIrdSynced() + ") to "
                            + collection + "/" + docId);

            log.info("Mirrored IRD state of {} to {}/{}", invoice.getInvoiceNumber(), collection, docId);

            return true;
        } catch (Exception e) {
            // Logged loudly but swallowed — see the method contract above.
            log.error("Could not mirror IRD state of invoice {} to {}/{}",
                    invoice.getInvoiceNumber(), collection, docId, e);

            return false;
        }
    }
}
