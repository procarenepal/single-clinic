package com.procaresoft.billing.controller;

import com.procaresoft.billing.dto.InvoiceRequestDto;
import com.procaresoft.billing.model.Invoice;
import com.procaresoft.billing.model.InvoiceItem;
import com.procaresoft.billing.repository.InvoiceRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;

import com.procaresoft.billing.service.IrdCbmsService;
import com.procaresoft.billing.service.AuditLogService;

@RestController
@RequestMapping("/api/billing")
public class BillingController {

    private final InvoiceRepository invoiceRepository;
    private final IrdCbmsService irdCbmsService;
    private final com.procaresoft.billing.service.InvoiceSequenceService invoiceSequenceService;
    private final AuditLogService auditLogService;

    public BillingController(InvoiceRepository invoiceRepository, IrdCbmsService irdCbmsService,
            com.procaresoft.billing.service.InvoiceSequenceService invoiceSequenceService,
            AuditLogService auditLogService) {
        this.invoiceRepository = invoiceRepository;
        this.irdCbmsService = irdCbmsService;
        this.invoiceSequenceService = invoiceSequenceService;
        this.auditLogService = auditLogService;
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
    @Transactional
    public ResponseEntity<Invoice> createInvoice(@Valid @RequestBody InvoiceRequestDto request,
            HttpServletRequest httpRequest) {

        String clinicId = requireClinicId(httpRequest);
        String userUid = requireUserUid(httpRequest);

        // Idempotent retry: if this exact create attempt (same clinic + key)
        // already produced an invoice — e.g. the first response was lost to a
        // dropped connection and the browser retried — return that invoice
        // instead of minting a duplicate.
        String idempotencyKey = request.getIdempotencyKey();
        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            java.util.Optional<Invoice> existing = invoiceRepository
                    .findByClinicIdAndIdempotencyKey(clinicId, idempotencyKey);
            if (existing.isPresent()) {
                return ResponseEntity.ok(existing.get());
            }
        }

        Invoice invoice = new Invoice();
        invoice.setClinicId(clinicId);
        invoice.setCreatedByUid(userUid);
        invoice.setIdempotencyKey(idempotencyKey);
        String invoiceNumber = (request.getPreAssignedInvoiceNumber() != null
                && !request.getPreAssignedInvoiceNumber().isBlank())
                        ? request.getPreAssignedInvoiceNumber()
                        : invoiceSequenceService.generateNextInvoiceNumber(clinicId, request.getFiscalYear());
        invoice.setInvoiceNumber(invoiceNumber);
        invoice.setInvoiceDate(LocalDate.now());
        invoice.setFiscalYear(request.getFiscalYear());

        invoice.setFirebasePatientId(request.getFirebasePatientId());
        invoice.setBuyerName(request.getBuyerName());
        invoice.setBuyerPan(request.getBuyerPan());

        invoice.setTotalAmount(request.getTotalAmount());
        invoice.setTaxableAmount(request.getTaxableAmount());
        invoice.setTaxAmount(request.getTaxAmount());
        invoice.setExemptAmount(request.getExemptAmount());
        invoice.setDiscountAmount(request.getDiscountAmount());
        invoice.setPaymentMethod(request.getPaymentMethod());

        invoice.setIrdSynced(false);

        for (InvoiceRequestDto.InvoiceItemDto itemDto : request.getItems()) {
            InvoiceItem item = new InvoiceItem();
            item.setItemName(itemDto.getItemName());
            item.setQuantity(itemDto.getQuantity());
            item.setRate(itemDto.getRate());
            item.setTotalAmount(itemDto.getTotalAmount());
            item.setTaxable(itemDto.isTaxable());
            invoice.addItem(item);
        }

        Invoice savedInvoice = invoiceRepository.save(invoice);

        if (request.isIrdEnabled()) {
            IrdCbmsService.SyncResult syncResult = irdCbmsService.syncInvoice(savedInvoice, request.getFiscalYear(),
                    request.isReturn());
            savedInvoice.setIrdSynced(syncResult.isSuccess());
            if (syncResult.isSuccess()) {
                savedInvoice.setIrdSyncDate(java.time.LocalDateTime.now());
            }
            savedInvoice.setCbmsResponseCode(syncResult.getResponseCode());
            savedInvoice = invoiceRepository.save(savedInvoice);
        }

        auditLogService.record("Invoice", savedInvoice.getId(), "CREATE", userUid, clinicId,
                "Invoice " + savedInvoice.getInvoiceNumber() + " created (total " + savedInvoice.getTotalAmount() + ")");

        return ResponseEntity.ok(savedInvoice);
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
