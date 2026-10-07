package com.procaresoft.billing.service;

import com.procaresoft.billing.dto.InvoiceRequestDto;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The ledger used to store whatever taxable/exempt/tax split the client sent,
 * with no check that it summed to the total. That is how 21 invoices were
 * filed with IRD under the wrong base split. These pin the reconciliation
 * rule that now stands in the way.
 */
class InvoiceCreationServiceAmountsTest {

    private static InvoiceRequestDto request(String total, String taxable, String exempt, String tax) {
        InvoiceRequestDto dto = new InvoiceRequestDto();
        dto.setTotalAmount(total == null ? null : new BigDecimal(total));
        dto.setTaxableAmount(taxable == null ? null : new BigDecimal(taxable));
        dto.setExemptAmount(exempt == null ? null : new BigDecimal(exempt));
        dto.setTaxAmount(tax == null ? null : new BigDecimal(tax));
        return dto;
    }

    @Test
    void acceptsASplitThatSumsToTheTotal() {
        // 1000 of services at 13% VAT: taxable 1000 + tax 130 = 1130.
        assertDoesNotThrow(() -> InvoiceCreationService.validateAmountsSum(
                request("1130.00", "1000.00", "0.00", "130.00")));
    }

    @Test
    void acceptsAMixedTaxableAndExemptInvoice() {
        // The INV-0031 shape, done right: 76.46 taxable + 58.50 exempt + 9.94 tax.
        assertDoesNotThrow(() -> InvoiceCreationService.validateAmountsSum(
                request("144.90", "76.46", "58.50", "9.94")));
    }

    @Test
    void rejectsTheWrongSplitThatWasActuallyFiled() {
        // INV-0031 as it was filed: total and tax right, exempt collapsed
        // into taxable. 134.96 + 0 + 9.94 = 144.90 — that one reconciles,
        // because the error moved value between taxable and exempt without
        // changing their sum. The check cannot catch THAT class; it catches
        // the class where the parts no longer add up to the total at all.
        assertDoesNotThrow(() -> InvoiceCreationService.validateAmountsSum(
                request("144.90", "134.96", "0.00", "9.94")));
    }

    @Test
    void rejectsPartsThatDoNotReachTheTotal() {
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> InvoiceCreationService.validateAmountsSum(
                        request("1130.00", "1000.00", "0.00", "0.00")));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        assertTrue(ex.getReason().contains("do not reconcile"));
        assertTrue(ex.getReason().contains("130"));
    }

    @Test
    void rejectsPartsThatOvershootTheTotal() {
        assertThrows(ResponseStatusException.class,
                () -> InvoiceCreationService.validateAmountsSum(
                        request("1000.00", "1000.00", "500.00", "130.00")));
    }

    @Test
    void toleratesRoundingOfOneRupeeOrLess() {
        // Per-line tax rounded to 2dp can drift the sum by a few paisa.
        assertDoesNotThrow(() -> InvoiceCreationService.validateAmountsSum(
                request("1130.00", "1000.00", "0.00", "129.01")));
        assertDoesNotThrow(() -> InvoiceCreationService.validateAmountsSum(
                request("1130.00", "1000.00", "0.00", "131.00")));
    }

    @Test
    void doesNotTolerateMoreThanOneRupee() {
        assertThrows(ResponseStatusException.class,
                () -> InvoiceCreationService.validateAmountsSum(
                        request("1130.00", "1000.00", "0.00", "131.01")));
    }

    @Test
    void treatsNullPartsAsZero() {
        // A fully-exempt sale carries no taxable amount and no tax.
        assertDoesNotThrow(() -> InvoiceCreationService.validateAmountsSum(
                request("500.00", null, "500.00", null)));
    }

    @Test
    void appliesTheSameIdentityToACreditNote() {
        // Negative throughout — the sign flips, the identity holds.
        assertDoesNotThrow(() -> InvoiceCreationService.validateAmountsSum(
                request("-1130.00", "-1000.00", "0.00", "-130.00")));
        assertThrows(ResponseStatusException.class,
                () -> InvoiceCreationService.validateAmountsSum(
                        request("-1130.00", "-1000.00", "0.00", "0.00")));
    }
}
