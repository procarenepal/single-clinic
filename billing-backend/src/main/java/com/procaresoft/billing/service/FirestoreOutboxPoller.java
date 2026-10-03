package com.procaresoft.billing.service;

import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.QueryDocumentSnapshot;
import com.google.firebase.cloud.FirestoreClient;
import com.procaresoft.billing.dto.InvoiceRequestDto;
import com.procaresoft.billing.model.Invoice;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Drains the billingSyncOutbox: sales that have already physically happened
 * (stock deducted, money taken) but whose ledger row was never created
 * because the create call failed.
 *
 * Why the backend owns this rather than the browser: the client that made
 * the sale may be closed seconds later, and a sale that was never filed with
 * IRD must not depend on someone reopening the app. This runs regardless.
 *
 * Safety: the poller never touches stock, so draining can never double-deduct.
 * Duplicate ledger rows are prevented by the idempotencyKey carried in the
 * stored payload together with the reused preAssignedInvoiceNumber — a second
 * attempt returns the invoice the first one created.
 */
@Service
public class FirestoreOutboxPoller {

    private static final Logger log = LoggerFactory.getLogger(FirestoreOutboxPoller.class);
    private static final String COLLECTION = "billingSyncOutbox";
    private static final int BATCH_SIZE = 20;
    private static final int MAX_ATTEMPTS = 10;

    private final InvoiceCreationService invoiceCreationService;
    // Tolerant of unknown fields, matching Spring's own mapper: a queued
    // payload may have been written by an older or newer client, and a
    // stricter mapper would park an otherwise-fileable sale forever.
    private final ObjectMapper objectMapper = new ObjectMapper()
            .configure(com.fasterxml.jackson.databind.DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    @Value("${billing.outbox-poller.enabled:true}")
    private boolean enabled;

    public FirestoreOutboxPoller(InvoiceCreationService invoiceCreationService) {
        this.invoiceCreationService = invoiceCreationService;
    }

    @Scheduled(fixedDelayString = "60000")
    public void drain() {
        if (!enabled) {
            return;
        }

        try {
            Firestore firestore = FirestoreClient.getFirestore();
            List<QueryDocumentSnapshot> pending = firestore.collection(COLLECTION)
                    .whereEqualTo("status", "pending")
                    .limit(BATCH_SIZE)
                    .get()
                    .get()
                    .getDocuments();

            if (pending.isEmpty()) {
                return;
            }

            log.info("Outbox: {} pending sale(s) not yet in the ledger", pending.size());

            for (QueryDocumentSnapshot entry : pending) {
                processEntry(firestore, entry);
            }
        } catch (Exception e) {
            // Never throw out of a scheduled method — a Firestore outage must
            // not kill the poller thread, it just means we try again next tick.
            log.error("Outbox drain failed", e);
        }
    }

    /**
     * Update one entry of a purchase's returns[] array in place. Read and
     * write happen in a Firestore transaction because the array is rewritten
     * wholesale: a plain read-modify-write would silently discard a return
     * added by someone else in between.
     */
    private void mirrorReturnState(Firestore firestore, String collection, String docId,
            String returnRecordId, Invoice saved) {
        if (collection == null || collection.isBlank() || docId == null || docId.isBlank()) {
            return;
        }

        try {
            var ref = firestore.collection(collection).document(docId);

            firestore.runTransaction(tx -> {
                DocumentSnapshot snap = tx.get(ref).get();

                if (!snap.exists()) {
                    return null;
                }

                @SuppressWarnings("unchecked")
                List<Map<String, Object>> returns =
                        (List<Map<String, Object>>) snap.get("returns");

                if (returns == null) {
                    return null;
                }

                boolean changed = false;
                for (Map<String, Object> r : returns) {
                    if (returnRecordId.equals(r.get("id"))) {
                        r.put("javaInvoiceId", saved.getId());
                        r.put("irdSynced", saved.isIrdSynced());
                        r.put("cbmsResponseCode", saved.getCbmsResponseCode());
                        r.put("creditNoteNumber", saved.getInvoiceNumber());
                        changed = true;
                        break;
                    }
                }

                if (changed) {
                    tx.update(ref, "returns", returns);
                }

                return null;
            }).get();

            log.info("Mirrored return {} state onto {}/{}", returnRecordId, collection, docId);
        } catch (Exception e) {
            log.error("Could not mirror return {} onto {}/{}", returnRecordId, collection, docId, e);
        }
    }

    private void processEntry(Firestore firestore, DocumentSnapshot entry) {
        String entryId = entry.getId();
        Long storedAttempts = entry.contains("attempts") ? entry.getLong("attempts") : null;
        long attempts = storedAttempts != null ? storedAttempts : 0L;

        try {
            if (attempts >= MAX_ATTEMPTS) {
                // Stop retrying and make it loud rather than looping forever
                // on something a human needs to look at.
                firestore.collection(COLLECTION).document(entryId)
                        .update(Map.of("status", "needs_review"));
                log.error("Outbox entry {} ({}) exceeded {} attempts — flagged for review",
                        entryId, entry.getString("invoiceNumber"), MAX_ATTEMPTS);

                return;
            }

            @SuppressWarnings("unchecked")
            Map<String, Object> rawPayload = (Map<String, Object>) entry.get("payload");
            String clinicId = entry.getString("clinicId");

            if (rawPayload == null || clinicId == null || clinicId.isBlank()) {
                firestore.collection(COLLECTION).document(entryId)
                        .update(Map.of(
                                "status", "needs_review",
                                "lastError", "Outbox entry is missing its payload or clinicId"));
                log.error("Outbox entry {} is malformed — flagged for review", entryId);

                return;
            }

            InvoiceRequestDto request = objectMapper.convertValue(rawPayload, InvoiceRequestDto.class);

            // A sale being filed late belongs to the date it actually
            // happened, not today. Only ever present on an approved
            // remediation entry — the HTTP /create path cannot backdate.
            LocalDate backfillDate = null;
            String rawBackfill = entry.getString("backfillInvoiceDate");
            if (rawBackfill != null && !rawBackfill.isBlank()) {
                try {
                    backfillDate = LocalDate.parse(rawBackfill);
                } catch (Exception dateError) {
                    throw new IllegalArgumentException(
                            "backfillInvoiceDate is not a valid ISO date: " + rawBackfill);
                }
            }

            // Attribute an approved remediation to whoever approved it; a
            // routine sweep has no human behind it, and claiming otherwise
            // would make the audit trail say something untrue.
            String approvedBy = entry.getString("approvedBy");
            String actingUid = (approvedBy != null && !approvedBy.isBlank()) ? approvedBy : "system";

            Invoice saved = invoiceCreationService.createFromRequest(request, clinicId, actingUid, backfillDate);

            Map<String, Object> done = new HashMap<>();
            done.put("status", "done");
            done.put("javaInvoiceId", saved.getId());
            done.put("invoiceNumber", saved.getInvoiceNumber());
            done.put("attempts", attempts + 1);
            done.put("lastError", null);
            firestore.collection(COLLECTION).document(entryId).update(done);

            // A pharmacy return's sync state lives inside its purchase
            // document's returns[] array, so it cannot be mirrored by the
            // ordinary field patch — that would overwrite the purchase's own
            // sync state. Rewrite just the one array entry, in a transaction,
            // so a concurrent write to the purchase cannot lose it.
            String returnRecordId = entry.getString("returnRecordId");
            if (returnRecordId != null && !returnRecordId.isBlank()) {
                mirrorReturnState(firestore, entry.getString("sourceCollection"),
                        entry.getString("sourceDocId"), returnRecordId, saved);
            }

            log.info("Outbox: filed {} from entry {} (ledger id {})",
                    saved.getInvoiceNumber(), entryId, saved.getId());
        } catch (Exception e) {
            Map<String, Object> failure = new HashMap<>();
            failure.put("attempts", attempts + 1);
            failure.put("lastError", e.getMessage() != null ? e.getMessage() : e.toString());
            try {
                firestore.collection(COLLECTION).document(entryId).update(failure);
            } catch (Exception updateError) {
                log.error("Could not record outbox failure for {}", entryId, updateError);
            }
            log.warn("Outbox entry {} failed (attempt {}/{}): {}",
                    entryId, attempts + 1, MAX_ATTEMPTS, e.getMessage());
        }
    }
}
