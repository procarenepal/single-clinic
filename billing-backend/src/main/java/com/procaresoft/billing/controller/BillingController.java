package com.procaresoft.billing.controller;

import com.procaresoft.billing.dto.InvoiceRequestDto;
import com.procaresoft.billing.model.Invoice;
import com.procaresoft.billing.model.InvoiceItem;
import com.procaresoft.billing.repository.InvoiceRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.procaresoft.billing.service.IrdCbmsService;

@RestController
@RequestMapping("/api/billing")
@CrossOrigin(origins = { "http://localhost:5173", "http://127.0.0.1:5173" }, allowedHeaders = "*")
public class BillingController {

    private final InvoiceRepository invoiceRepository;
    private final IrdCbmsService irdCbmsService;
    private final com.procaresoft.billing.service.InvoiceSequenceService invoiceSequenceService;

    public BillingController(InvoiceRepository invoiceRepository, IrdCbmsService irdCbmsService,
            com.procaresoft.billing.service.InvoiceSequenceService invoiceSequenceService) {
        this.invoiceRepository = invoiceRepository;
        this.irdCbmsService = irdCbmsService;
        this.invoiceSequenceService = invoiceSequenceService;
    }

    @PostMapping("/create")
    public ResponseEntity<Invoice> createInvoice(@Valid @RequestBody InvoiceRequestDto request) {

        Invoice invoice = new Invoice();
        invoice.setInvoiceNumber(invoiceSequenceService.generateNextInvoiceNumber());
        invoice.setInvoiceDate(LocalDate.now());

        invoice.setFirebasePatientId(request.getFirebasePatientId());
        invoice.setBuyerName(request.getBuyerName());
        invoice.setBuyerPan(request.getBuyerPan());

        invoice.setTotalAmount(request.getTotalAmount());
        invoice.setTaxableAmount(request.getTaxableAmount());
        invoice.setTaxAmount(request.getTaxAmount());
        invoice.setExemptAmount(request.getExemptAmount());

        invoice.setIrdSynced(false); // Default to false until IRD confirms

        if (request.getItems() != null) {
            for (InvoiceRequestDto.InvoiceItemDto itemDto : request.getItems()) {
                InvoiceItem item = new InvoiceItem();
                item.setItemName(itemDto.getItemName());
                item.setQuantity(itemDto.getQuantity());
                item.setRate(itemDto.getRate());
                item.setTotalAmount(itemDto.getTotalAmount());
                item.setTaxable(itemDto.isTaxable());

                invoice.addItem(item);
            }
        }

        Invoice savedInvoice = invoiceRepository.save(invoice);

        // Firebase is now the sole master for IRD CBMS Sync (Option A).
        // The Java backend will act as a read-only SQL ledger and will NOT attempt to double-sync to the IRD API.
        /*
        if (request.isIrdEnabled()) {
            IrdCbmsService.SyncResult syncResult = irdCbmsService.syncInvoice(savedInvoice, request);
            savedInvoice.setIrdSynced(syncResult.isSuccess());
            if (syncResult.isSuccess()) {
                savedInvoice.setIrdSyncDate(java.time.LocalDateTime.now());
            }
            savedInvoice.setCbmsResponseCode(syncResult.getResponseCode());
            savedInvoice = invoiceRepository.save(savedInvoice);
        }
        */

        return ResponseEntity.ok(savedInvoice);
    }

    @GetMapping("/patient/{firebasePatientId}")
    public ResponseEntity<org.springframework.data.domain.Page<Invoice>> getPatientInvoices(
            @PathVariable String firebasePatientId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        org.springframework.data.domain.Pageable pageable = org.springframework.data.domain.PageRequest.of(page, size);
        return ResponseEntity
                .ok(invoiceRepository.findByFirebasePatientIdOrderByInvoiceDateDesc(firebasePatientId, pageable));
    }

    @PutMapping("/{id}/ird-sync")
    public ResponseEntity<Invoice> updateIrdSyncStatus(
            @PathVariable Long id,
            @RequestParam(defaultValue = "true") boolean synced,
            @RequestParam(required = false) String responseCode) {
        return invoiceRepository.findById(id).map(invoice -> {
            invoice.setIrdSynced(synced);
            invoice.setIrdSyncDate(java.time.LocalDateTime.now());
            if (responseCode != null) {
                invoice.setCbmsResponseCode(responseCode);
            }
            return ResponseEntity.ok(invoiceRepository.save(invoice));
        }).orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/retry-sync")
    public ResponseEntity<Invoice> retryIrdSync(
            @PathVariable Long id,
            @RequestBody com.procaresoft.billing.dto.IrdSyncRequestDto request) {
        return invoiceRepository.findById(id).map(invoice -> {
            IrdCbmsService.SyncResult syncResult = irdCbmsService.syncInvoice(invoice, request);
            invoice.setIrdSynced(syncResult.isSuccess());
            if (syncResult.isSuccess()) {
                invoice.setIrdSyncDate(java.time.LocalDateTime.now());
            }
            invoice.setCbmsResponseCode(syncResult.getResponseCode());
            return ResponseEntity.ok(invoiceRepository.save(invoice));
        }).orElse(ResponseEntity.notFound().build());
    }
}
