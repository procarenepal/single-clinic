package com.procaresoft.billing.controller;

import com.procaresoft.billing.dto.InvoiceRequestDto;
import com.procaresoft.billing.model.Invoice;
import com.procaresoft.billing.repository.InvoiceRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * A create-invoice request can be safely retried after a dropped connection:
 * if the browser resends the same idempotencyKey (because it never received
 * the first response), the backend must return the already-created invoice
 * instead of minting a duplicate ledger entry. Without this, a network
 * interruption at the wrong moment could produce two real invoice numbers
 * for what the user believes was a single sale — a genuine compliance risk,
 * not just a UX annoyance.
 */
@SpringBootTest
@ActiveProfiles("test")
class BillingControllerIdempotencyTest {

    @Autowired
    private BillingController billingController;

    @Autowired
    private InvoiceRepository invoiceRepository;

    @Autowired
    private PlatformTransactionManager transactionManager;

    /**
     * createInvoice is @Transactional; invoking it back-to-back in the same
     * test method (no surrounding HTTP request/OSIV boundary) needs each
     * call wrapped so its transaction actually commits before the next call
     * reads the invoice-sequence counter — matching how InvoiceSequenceServiceTest
     * already has to do this for the same reason.
     */
    private ResponseEntity<Invoice> createInvoiceInOwnTransaction(
            InvoiceRequestDto request, HttpServletRequest httpRequest) {
        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        return tx.execute(status -> billingController.createInvoice(request, httpRequest));
    }

    private HttpServletRequest requestFrom(String clinicId, String userUid) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setAttribute("clinicId", clinicId);
        request.setAttribute("userUid", userUid);
        return request;
    }

    private InvoiceRequestDto sampleRequest(String idempotencyKey) {
        InvoiceRequestDto dto = new InvoiceRequestDto();
        dto.setBuyerName("Test Patient");
        dto.setTotalAmount(new BigDecimal("500.00"));
        dto.setTaxableAmount(BigDecimal.ZERO);
        dto.setTaxAmount(BigDecimal.ZERO);
        dto.setExemptAmount(new BigDecimal("500.00"));
        dto.setFiscalYear("2083.84");
        dto.setIdempotencyKey(idempotencyKey);

        InvoiceRequestDto.InvoiceItemDto item = new InvoiceRequestDto.InvoiceItemDto();
        item.setItemName("Consultation");
        item.setQuantity(1);
        item.setRate(new BigDecimal("500.00"));
        item.setTotalAmount(new BigDecimal("500.00"));
        dto.setItems(List.of(item));

        return dto;
    }

    @Test
    void sameKeyReturnsExistingInvoiceButDifferentKeysCreateDistinctOnes() {
        String clinicId = "idempotency-test-clinic-" + UUID.randomUUID();
        HttpServletRequest httpRequest = requestFrom(clinicId, "test-user");

        // A retry with the SAME idempotency key (the browser resending after
        // the first response was lost) must return the same invoice, not
        // create a duplicate.
        String idempotencyKey = UUID.randomUUID().toString();

        ResponseEntity<Invoice> first = createInvoiceInOwnTransaction(
                sampleRequest(idempotencyKey), httpRequest);
        ResponseEntity<Invoice> retry = createInvoiceInOwnTransaction(
                sampleRequest(idempotencyKey), httpRequest);

        assertThat(first.getBody()).isNotNull();
        assertThat(retry.getBody()).isNotNull();
        assertThat(retry.getBody().getId()).isEqualTo(first.getBody().getId());
        assertThat(retry.getBody().getInvoiceNumber()).isEqualTo(first.getBody().getInvoiceNumber());

        long countForClinic = invoiceRepository
                .findByClinicIdOrderByInvoiceDateDesc(clinicId, org.springframework.data.domain.PageRequest.of(0, 10))
                .getTotalElements();
        assertThat(countForClinic).isEqualTo(1);

        // A genuinely new submission (different key) for the same clinic
        // must still create a distinct invoice — the guard only blocks an
        // exact-key repeat, not legitimate new sales.
        ResponseEntity<Invoice> second = createInvoiceInOwnTransaction(
                sampleRequest(UUID.randomUUID().toString()), httpRequest);

        assertThat(second.getBody().getId()).isNotEqualTo(first.getBody().getId());
        assertThat(second.getBody().getInvoiceNumber()).isNotEqualTo(first.getBody().getInvoiceNumber());
    }
}
