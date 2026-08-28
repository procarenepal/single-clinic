package com.procaresoft.billing.dto;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Nothing in InvoiceRequestDto had bean-validation coverage — an invoice with
 * a missing buyerName, malformed fiscalYear, or an empty items list would
 * previously reach the controller unchecked. These tests pin down what's
 * required.
 */
class InvoiceRequestDtoValidationTest {

    private static ValidatorFactory factory;
    private static Validator validator;

    @BeforeAll
    static void setUp() {
        factory = Validation.buildDefaultValidatorFactory();
        validator = factory.getValidator();
    }

    @AfterAll
    static void tearDown() {
        factory.close();
    }

    private InvoiceRequestDto validDto() {
        InvoiceRequestDto dto = new InvoiceRequestDto();
        dto.setBuyerName("Cash Sales");
        dto.setTotalAmount(new BigDecimal("113.00"));
        dto.setTaxableAmount(new BigDecimal("100.00"));
        dto.setTaxAmount(new BigDecimal("13.00"));
        dto.setExemptAmount(BigDecimal.ZERO);
        dto.setFiscalYear("2080.081");

        InvoiceRequestDto.InvoiceItemDto item = new InvoiceRequestDto.InvoiceItemDto();
        item.setItemName("Consultation");
        item.setQuantity(1);
        item.setRate(new BigDecimal("100.00"));
        item.setTotalAmount(new BigDecimal("100.00"));
        item.setTaxable(true);
        dto.setItems(List.of(item));

        return dto;
    }

    @Test
    void validDtoHasNoViolations() {
        assertTrue(validator.validate(validDto()).isEmpty());
    }

    @Test
    void rejectsMissingBuyerName() {
        InvoiceRequestDto dto = validDto();
        dto.setBuyerName(null);
        assertHasViolationFor(dto, "buyerName");
    }

    @Test
    void rejectsMissingFiscalYear() {
        InvoiceRequestDto dto = validDto();
        dto.setFiscalYear(null);
        assertHasViolationFor(dto, "fiscalYear");
    }

    @Test
    void rejectsMalformedFiscalYear() {
        InvoiceRequestDto dto = validDto();
        dto.setFiscalYear("2080/081");
        assertHasViolationFor(dto, "fiscalYear");
    }

    @Test
    void rejectsEmptyItemsList() {
        InvoiceRequestDto dto = validDto();
        dto.setItems(List.of());
        assertHasViolationFor(dto, "items");
    }

    @Test
    void rejectsItemWithMissingRate() {
        InvoiceRequestDto dto = validDto();
        dto.getItems().get(0).setRate(null);
        Set<ConstraintViolation<InvoiceRequestDto>> violations = validator.validate(dto);
        assertFalse(violations.isEmpty());
    }

    @Test
    void rejectsMissingTotalAmount() {
        InvoiceRequestDto dto = validDto();
        dto.setTotalAmount(null);
        assertHasViolationFor(dto, "totalAmount");
    }

    private void assertHasViolationFor(InvoiceRequestDto dto, String propertyPath) {
        Set<ConstraintViolation<InvoiceRequestDto>> violations = validator.validate(dto);
        boolean found = violations.stream()
                .anyMatch(v -> v.getPropertyPath().toString().equals(propertyPath));
        assertTrue(found, "Expected a violation on '" + propertyPath + "' but got: " + violations);
    }
}
