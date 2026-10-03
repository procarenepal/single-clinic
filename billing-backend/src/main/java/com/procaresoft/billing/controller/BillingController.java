package com.procaresoft.billing.controller;

import com.procaresoft.billing.dto.InvoiceRequestDto;
import com.procaresoft.billing.dto.LedgerRecordDto;
import com.procaresoft.billing.model.Invoice;
import com.procaresoft.billing.model.InvoiceItem;
import com.procaresoft.billing.repository.InvoiceRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;

import com.procaresoft.billing.service.IrdCbmsService;
import com.procaresoft.billing.service.AuditLogService;
import com.procaresoft.billing.service.InvoiceCreationService;
import com.procaresoft.billing.service.FirestoreMirrorService;

@RestController
@RequestMapping("/api/billing")
public class BillingController {

    private final InvoiceRepository invoiceRepository;
    private final IrdCbmsService irdCbmsService;
    private final com.procaresoft.billing.service.InvoiceSequenceService invoiceSequenceService;
    private final AuditLogService auditLogService;
    private final InvoiceCreationService invoiceCreationService;
    private final FirestoreMirrorService firestoreMirrorService;

    public BillingController(InvoiceRepository invoiceRepository, IrdCbmsService irdCbmsService,
            com.procaresoft.billing.service.InvoiceSequenceService invoiceSequenceService,
            AuditLogService auditLogService, InvoiceCreationService invoiceCreationService,
            FirestoreMirrorService firestoreMirrorService) {
        this.invoiceRepository = invoiceRepository;
        this.irdCbmsService = irdCbmsService;
        this.invoiceSequenceService = invoiceSequenceService;
        this.auditLogService = auditLogService;
        this.invoiceCreationService = invoiceCreationService;
        this.firestoreMirrorService = firestoreMirrorService;
    }

    /** clinicId is resolved server-side by FirebaseAuthFilter from the caller's Firestore user doc. */
    private String requireClinicId(HttpServletRequest httpRequest) {
        String clinicId = (String) httpRequest.getAttribute("clinicId");
        if (clinicId == null || clinicId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "No clinic is associated with the authenticated user");
        }
        return clinicId;
    }

    private String requireUserUid(HttpServletRequest httpRequest) {
        return (String) httpRequest.getAttribute("userUid");
    }

    @PostMapping("/create")
    public ResponseEntity<Invoice> createInvoice(@Valid @RequestBody InvoiceRequestDto request,
            HttpServletRequest httpRequest) {

        String clinicId = requireClinicId(httpRequest);
        String userUid = requireUserUid(httpRequest);

        return ResponseEntity.ok(invoiceCreationService.createFromRequest(request, clinicId, userUid));
    }

    /**
     * Look up one ledger row by its invoice number, scoped to the caller's
     * clinic. 404 means no ledger entry exists — which is the only safe
     * basis for concluding a sale was never filed with IRD.
     */
    @GetMapping("/invoice-by-number")
    public ResponseEntity<LedgerRecordDto> getInvoiceByNumber(@RequestParam String invoiceNumber,
            HttpServletRequest httpRequest) {

        String clinicId = requireClinicId(httpRequest);

        return invoiceRepository.findByClinicIdAndInvoiceNumber(clinicId, invoiceNumber)
                .map(LedgerRecordDto::fromInvoice)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    /**
     * The ledger as reconciliation needs to see it — including the sync
     * attempt/response/review state and source-document pointer that
     * Schedule 5 deliberately does not carry.
     *
     * syncState: all (default) | unsynced | needsReview.
     */
    @GetMapping("/reconciliation")
    public ResponseEntity<Page<LedgerRecordDto>> getReconciliation(
            @RequestParam(required = false) String fiscalYear,
            @RequestParam(required = false, defaultValue = "all") String syncState,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "200") int size,
            HttpServletRequest httpRequest) {

        String clinicId = requireClinicId(httpRequest);
        Pageable pageable = PageRequest.of(page, Math.min(size, 500));

        Page<Invoice> result;
        if ("unsynced".equalsIgnoreCase(syncState)) {
            result = invoiceRepository.findByClinicIdAndIrdSyncedFalseOrderByInvoiceNumberAsc(clinicId, pageable);
        } else if ("needsReview".equalsIgnoreCase(syncState)) {
            result = invoiceRepository.findByClinicIdAndIrdNeedsManualReviewTrueOrderByInvoiceNumberAsc(clinicId,
                    pageable);
        } else if (fiscalYear != null && !fiscalYear.isBlank()) {
            result = invoiceRepository.findByClinicIdAndFiscalYearOrderByInvoiceNumberAsc(clinicId, fiscalYear,
                    pageable);
        } else {
            result = invoiceRepository.findByClinicIdOrderByInvoiceNumberAsc(clinicId, pageable);
        }

        return ResponseEntity.ok(result.map(LedgerRecordDto::fromInvoice));
    }

    /**
     * Attach the Firestore document pointer to an existing ledger row, then
     * mirror its IRD state onto that document.
     *
     * Rows created before the pointer column existed have none, so the mirror
     * has nothing to address and their sync badge can never be corrected.
     * The caller supplies a mapping it has already established by exact match
     * (shared javaInvoiceId, or identical invoice number) — this is evidence,
     * not a guess, which is why the backend accepts it.
     *
     * Guards: never repoints a row that already has a different pointer, and
     * refuses returns outright — a pharmacy return's ledger row corresponds to
     * an entry nested inside its purchase document, so mirroring onto that
     * document would overwrite the purchase's own sync state.
     */
    @PostMapping("/{id}/source-pointer")
    public ResponseEntity<LedgerRecordDto> attachSourcePointer(
            @PathVariable Long id,
            @RequestBody java.util.Map<String, String> body,
            HttpServletRequest httpRequest) {

        String clinicId = requireClinicId(httpRequest);
        String collection = body.get("sourceCollection");
        String docId = body.get("sourceDocId");

        if (collection == null || collection.isBlank() || docId == null || docId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "sourceCollection and sourceDocId are both required");
        }

        return invoiceRepository.findById(id).map(invoice -> {
            if (!clinicId.equals(invoice.getClinicId())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Invoice belongs to a different clinic");
            }

            boolean isReturn = (invoice.getTotalAmount() != null && invoice.getTotalAmount().signum() < 0)
                    || (invoice.getRefInvoiceNumber() != null && !invoice.getRefInvoiceNumber().isBlank());
            if (isReturn) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "This is a return. Its state belongs to an entry nested inside the purchase document, "
                                + "so pointing it at that document would overwrite the purchase's own sync state.");
            }

            String existing = invoice.getSourceCollection();
            if (existing != null && !existing.isBlank()) {
                boolean same = existing.equals(collection) && docId.equals(invoice.getSourceDocId());
                if (!same) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT,
                            "This invoice already points at " + existing + "/" + invoice.getSourceDocId());
                }
            } else {
                invoice.setSourceCollection(collection);
                invoice.setSourceDocId(docId);
                invoiceRepository.save(invoice);
                auditLogService.record("Invoice", invoice.getId(), "UPDATE", requireUserUid(httpRequest), clinicId,
                        "Attached source pointer " + collection + "/" + docId
                                + " to " + invoice.getInvoiceNumber());
            }

            firestoreMirrorService.mirrorSyncState(invoice);

            return ResponseEntity.ok(LedgerRecordDto.fromInvoice(invoice));
        }).orElseGet(() -> ResponseEntity.notFound().build());
    }

    /**
     * Atomically reserves the next number from the SAME shared invoice
     * sequence used by /create, without creating an Invoice row. Exists for
     * pharmacy, whose Firestore stock-deduction transaction is irreversible
     * and must complete even if the /create Java call afterward fails or is
     * slow — pharmacy reserves a number here first, uses it as the receipt
     * number for that transaction, then passes it back as
     * preAssignedInvoiceNumber when it later calls /create, so no second
     * number is minted. This is what keeps pharmacy on the same gapless,
     * per-clinic+fiscal-year counter as appointment/pathology invoices
     * instead of a separate numbering track.
     */
    @PostMapping("/reserve-number")
    @Transactional
    public ResponseEntity<java.util.Map<String, String>> reserveNumber(
            @Valid @RequestBody com.procaresoft.billing.dto.ReserveInvoiceNumberRequestDto request,
            HttpServletRequest httpRequest) {
        String clinicId = requireClinicId(httpRequest);
        String invoiceNumber = invoiceSequenceService.generateNextInvoiceNumber(
                clinicId, request.getFiscalYear(), request.getPrefix());

        return ResponseEntity.ok(java.util.Map.of("invoiceNumber", invoiceNumber));
    }

    @GetMapping("/patient/{firebasePatientId}")
    public ResponseEntity<org.springframework.data.domain.Page<Invoice>> getPatientInvoices(
            @PathVariable String firebasePatientId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            HttpServletRequest httpRequest) {
        String clinicId = requireClinicId(httpRequest);
        org.springframework.data.domain.Pageable pageable = org.springframework.data.domain.PageRequest.of(page, size);
        org.springframework.data.domain.Page<Invoice> results = invoiceRepository
                .findByFirebasePatientIdOrderByInvoiceDateDesc(firebasePatientId, pageable);

        boolean crossTenant = results.getContent().stream().anyMatch(inv -> !clinicId.equals(inv.getClinicId()));
        if (crossTenant) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Invoice belongs to a different clinic");
        }
        return ResponseEntity.ok(results);
    }

    @PostMapping("/{id}/retry-sync")
    public ResponseEntity<Invoice> retryIrdSync(
            @PathVariable Long id,
            @Valid @RequestBody com.procaresoft.billing.dto.IrdSyncRequestDto request,
            HttpServletRequest httpRequest) {
        String clinicId = requireClinicId(httpRequest);

        return invoiceRepository.findById(id).map(invoice -> {
            if (!clinicId.equals(invoice.getClinicId())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Invoice belongs to a different clinic");
            }

            IrdCbmsService.SyncResult syncResult = irdCbmsService.syncInvoice(invoice, request.getFiscalYear(),
                    request.isReturn());
            invoice.setIrdSynced(syncResult.isSuccess());
            if (syncResult.isSuccess()) {
                invoice.setIrdSyncDate(java.time.LocalDateTime.now());
            }
            invoice.setCbmsResponseCode(syncResult.getResponseCode());
            Invoice saved = invoiceRepository.save(invoice);

            auditLogService.record("Invoice", saved.getId(), "UPDATE", requireUserUid(httpRequest), clinicId,
                    "IRD retry-sync for " + saved.getInvoiceNumber() + ": " + (syncResult.isSuccess() ? "success" : "failed"));

            // Keep the app's copy in step without relying on the caller to
            // write it back — once clients lose write access to the IRD
            // fields, this is the only thing that updates them.
            firestoreMirrorService.mirrorSyncState(saved);

            return ResponseEntity.ok(saved);
        }).orElse(ResponseEntity.notFound().build());
    }

    /**
     * Cancels an invoice with a mandatory documented reason (IRD clause 6(झ)).
     * This never deletes or edits the invoice's financial fields — it only
     * flips `active` to false (clause 6(घ)/6(ठ)'s "record effectiveness"),
     * so the original data submitted to IRD is never altered, only marked
     * no-longer-live. A cancelled invoice remains fully visible in the
     * Schedule 5 report with its reason in the audit log.
     */
    @PostMapping("/{id}/cancel")
    @Transactional
    public ResponseEntity<Invoice> cancelInvoice(
            @PathVariable Long id,
            @Valid @RequestBody com.procaresoft.billing.dto.CancelInvoiceRequestDto request,
            HttpServletRequest httpRequest) {
        String clinicId = requireClinicId(httpRequest);
        String userUid = requireUserUid(httpRequest);

        return invoiceRepository.findById(id).map(invoice -> {
            if (!clinicId.equals(invoice.getClinicId())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Invoice belongs to a different clinic");
            }
            if (!invoice.isActive()) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Invoice is already cancelled");
            }

            invoice.setActive(false);
            Invoice saved = invoiceRepository.save(invoice);

            auditLogService.record("Invoice", saved.getId(), "CANCEL", userUid, clinicId,
                    "Invoice " + saved.getInvoiceNumber() + " cancelled. Reason: " + request.getReason());

            return ResponseEntity.ok(saved);
        }).orElse(ResponseEntity.notFound().build());
    }

    /**
     * Records a print/reprint event for the Schedule 5 report's
     * Is_Bill_Printed/Printed_Time/Printed_By fields (clause 6(ङ)). The
     * frontend's own reprint-count-and-"Copy of Original"-numbering logic
     * (clause 6(च)) lives in Firestore and is unaffected by this — this call
     * just mirrors that same event into the authoritative MySQL ledger so
     * the Java-side Schedule 5 report isn't permanently blank for these
     * fields. Never blocks/fails the print itself: callers should fire this
     * after printing succeeds and not treat a failure here as fatal.
     */
    @PostMapping("/{id}/record-print")
    @Transactional
    public ResponseEntity<Invoice> recordPrint(
            @PathVariable Long id,
            HttpServletRequest httpRequest) {
        String clinicId = requireClinicId(httpRequest);
        String userUid = requireUserUid(httpRequest);

        return invoiceRepository.findById(id).map(invoice -> {
            if (!clinicId.equals(invoice.getClinicId())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Invoice belongs to a different clinic");
            }

            invoice.setPrintCount(invoice.getPrintCount() + 1);
            invoice.setLastPrintedAt(java.time.LocalDateTime.now());
            invoice.setLastPrintedBy(userUid);
            Invoice saved = invoiceRepository.save(invoice);

            auditLogService.record("Invoice", saved.getId(), "PRINT", userUid, clinicId,
                    "Invoice " + saved.getInvoiceNumber() + " printed (copy #" + saved.getPrintCount() + ")");

            return ResponseEntity.ok(saved);
        }).orElse(ResponseEntity.notFound().build());
    }

    /**
     * The Schedule 5 (अनुसूची ५) master invoice table — required to be
     * viewable and printable from the front end, per clause 6(ङ). Optionally
     * scoped to one fiscal year, matching how the schedule describes the
     * table ("हरेक आर्थिक वर्षमा सिलसिलेवार").
     */
    @GetMapping("/schedule5-report")
    public ResponseEntity<org.springframework.data.domain.Page<com.procaresoft.billing.dto.Schedule5RecordDto>> getSchedule5Report(
            @RequestParam(required = false) String fiscalYear,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            HttpServletRequest httpRequest) {
        String clinicId = requireClinicId(httpRequest);
        org.springframework.data.domain.Pageable pageable = org.springframework.data.domain.PageRequest.of(page, size);

        org.springframework.data.domain.Page<Invoice> invoices = (fiscalYear != null && !fiscalYear.isBlank())
                ? invoiceRepository.findByClinicIdAndFiscalYearOrderByInvoiceDateDesc(clinicId, fiscalYear, pageable)
                : invoiceRepository.findByClinicIdOrderByInvoiceDateDesc(clinicId, pageable);

        return ResponseEntity.ok(invoices.map(com.procaresoft.billing.dto.Schedule5RecordDto::fromInvoice));
    }

    @GetMapping("/audit-log")
    public ResponseEntity<org.springframework.data.domain.Page<com.procaresoft.billing.model.AuditLog>> getAuditLog(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            HttpServletRequest httpRequest) {
        String clinicId = requireClinicId(httpRequest);
        org.springframework.data.domain.Pageable pageable = org.springframework.data.domain.PageRequest.of(page, size);
        return ResponseEntity.ok(auditLogService.getForClinic(clinicId, pageable));
    }
}
