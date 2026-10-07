package com.procaresoft.billing.service;

import com.procaresoft.billing.dto.InvoiceRequestDto;
import com.procaresoft.billing.model.Invoice;
import com.procaresoft.billing.model.InvoiceItem;
import com.procaresoft.billing.repository.InvoiceRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Optional;

/**
 * The single place an Invoice row is born.
 *
 * Extracted from BillingController so that every path which must produce a
 * ledger entry — the HTTP endpoint today, the pharmacy outbox poller and the
 * remediation flow later — goes through identical logic. Previously this
 * lived only inside a controller method, which is why other paths "filed"
 * sales by pushing straight to IRD without ever creating a ledger row.
 */
@Service
public class InvoiceCreationService {

    private final InvoiceRepository invoiceRepository;
    private final IrdCbmsService irdCbmsService;
    private final InvoiceSequenceService invoiceSequenceService;
    private final AuditLogService auditLogService;
    private final FirestoreMirrorService firestoreMirrorService;

    public InvoiceCreationService(InvoiceRepository invoiceRepository, IrdCbmsService irdCbmsService,
            InvoiceSequenceService invoiceSequenceService, AuditLogService auditLogService,
            FirestoreMirrorService firestoreMirrorService) {
        this.invoiceRepository = invoiceRepository;
        this.irdCbmsService = irdCbmsService;
        this.invoiceSequenceService = invoiceSequenceService;
        this.auditLogService = auditLogService;
        this.firestoreMirrorService = firestoreMirrorService;
    }

    @Transactional
    public Invoice createFromRequest(InvoiceRequestDto request, String clinicId, String userUid) {
        return createFromRequest(request, clinicId, userUid, null);
    }

    /**
     * Largest tolerated gap between the client's stated total and the sum of
     * its own parts. One rupee covers rounding of a per-line tax split to
     * two decimals; anything beyond it is a wrong split, not rounding.
     */
    static final BigDecimal AMOUNT_TOLERANCE = BigDecimal.ONE;

    /**
     * Rejects an invoice whose taxable + exempt + tax does not equal its
     * total.
     *
     * This ledger is what CBMS is filed from, and it used to accept whatever
     * split the browser computed — the four amounts were stored verbatim
     * with no check that they described the same number. That is how 21
     * invoices reached IRD with the right total and tax but the wrong
     * taxable/exempt base, and nothing stood in the way of it happening
     * again. CBMS has no amend operation, so a wrong split that gets filed
     * can only be corrected by credit-note-and-reissue; refusing it here is
     * the only cheap place to stop it.
     *
     * Null amounts are treated as zero rather than rejected: a fully-exempt
     * sale legitimately carries no taxable amount and no tax. Negative
     * totals (credit notes) satisfy the same identity with the sign
     * flipped, so no special case is needed.
     */
    static void validateAmountsSum(InvoiceRequestDto request) {
        BigDecimal total = nz(request.getTotalAmount());
        BigDecimal parts = nz(request.getTaxableAmount())
                .add(nz(request.getExemptAmount()))
                .add(nz(request.getTaxAmount()));
        BigDecimal gap = total.subtract(parts).abs();

        if (gap.compareTo(AMOUNT_TOLERANCE) > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, String.format(
                    "Invoice amounts do not reconcile: taxable %s + exempt %s + tax %s = %s, but total is %s (gap %s). "
                    + "The split must sum to the total before it can be filed.",
                    nz(request.getTaxableAmount()), nz(request.getExemptAmount()), nz(request.getTaxAmount()),
                    parts, total, gap));
        }
    }

    private static BigDecimal nz(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    /**
     * @param invoiceDateOverride the date the sale actually happened, for
     *     filing a sale that was missed at the time. Deliberately a method
     *     parameter rather than a field on InvoiceRequestDto: the HTTP
     *     /create endpoint passes null and therefore cannot be used to
     *     backdate an invoice, while the remediation path — which is
     *     approval-gated — can.
     */
    @Transactional
    public Invoice createFromRequest(InvoiceRequestDto request, String clinicId, String userUid,
            LocalDate invoiceDateOverride) {

        // Idempotent retry: if this exact create attempt (same clinic + key)
        // already produced an invoice — e.g. the first response was lost to a
        // dropped connection and the browser retried — return that invoice
        // instead of minting a duplicate.
        String idempotencyKey = request.getIdempotencyKey();
        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            Optional<Invoice> existing = invoiceRepository
                    .findByClinicIdAndIdempotencyKey(clinicId, idempotencyKey);
            if (existing.isPresent()) {
                return existing.get();
            }
        }

        Invoice invoice = new Invoice();
        invoice.setClinicId(clinicId);
        invoice.setCreatedByUid(userUid);
        invoice.setIdempotencyKey(idempotencyKey);
        String invoiceNumber = (request.getPreAssignedInvoiceNumber() != null
                && !request.getPreAssignedInvoiceNumber().isBlank())
                        ? request.getPreAssignedInvoiceNumber()
                        : invoiceSequenceService.generateNextInvoiceNumber(clinicId, request.getFiscalYear(),
                                request.getInvoicePrefix());
        invoice.setInvoiceNumber(invoiceNumber);
        invoice.setInvoiceDate(invoiceDateOverride != null ? invoiceDateOverride : LocalDate.now());
        invoice.setFiscalYear(request.getFiscalYear());

        invoice.setFirebasePatientId(request.getFirebasePatientId());
        invoice.setBuyerName(request.getBuyerName());
        invoice.setBuyerPan(request.getBuyerPan());

        validateAmountsSum(request);

        invoice.setTotalAmount(request.getTotalAmount());
        invoice.setTaxableAmount(request.getTaxableAmount());
        invoice.setTaxAmount(request.getTaxAmount());
        invoice.setExemptAmount(request.getExemptAmount());
        invoice.setDiscountAmount(request.getDiscountAmount());
        invoice.setPaymentMethod(request.getPaymentMethod());
        if (request.isReturn()) {
            invoice.setRefInvoiceNumber(request.getRefInvoiceNumber());
            invoice.setReasonForReturn(request.getReasonForReturn());
        }

        // Where this invoice came from, so sync state can later be mirrored
        // back to exactly that document instead of guessed at.
        invoice.setSourceCollection(request.getSourceCollection());
        invoice.setSourceDocId(request.getSourceDocId());

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

        Invoice savedInvoice;
        try {
            savedInvoice = invoiceRepository.save(invoice);
        } catch (org.springframework.dao.DataIntegrityViolationException e) {
            // The (clinic_id, idempotency_key) unique index (V5 migration)
            // is the real, DB-level backstop for the check above — two
            // concurrent retries of the same create-invoice request can
            // both pass the findByClinicIdAndIdempotencyKey check before
            // either commits, but only one INSERT can win here. This
            // transaction is now rollback-only (Hibernate marks the
            // persistence context unusable after a failed flush), so we
            // can't safely re-query for the winner's row here — return a
            // clean 409 instead of an opaque 500; the client's own retry
            // (same idempotency key, a fresh request/transaction) will
            // cleanly hit the idempotent-retry branch above and get the
            // winner's invoice back.
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "This invoice was already created by a concurrent request — please retry.");
        }

        if (request.isIrdEnabled()) {
            IrdCbmsService.SyncResult syncResult = irdCbmsService.syncInvoice(savedInvoice, request.getFiscalYear(),
                    request.isReturn());
            savedInvoice.setIrdSynced(syncResult.isSuccess());
            if (syncResult.isSuccess()) {
                savedInvoice.setIrdSyncDate(LocalDateTime.now());
            }
            savedInvoice.setCbmsResponseCode(syncResult.getResponseCode());
            savedInvoice = invoiceRepository.save(savedInvoice);
        }

        auditLogService.record("Invoice", savedInvoice.getId(), "CREATE", userUid, clinicId,
                "Invoice " + savedInvoice.getInvoiceNumber() + " created (total " + savedInvoice.getTotalAmount() + ")");

        // Publish the authoritative sync state straight back to the source
        // document, so the backend is the only writer of these fields on
        // every path — creation included, not just retries. This is what
        // lets the client lose write access to them entirely.
        firestoreMirrorService.mirrorSyncState(savedInvoice);

        return savedInvoice;
    }
}
