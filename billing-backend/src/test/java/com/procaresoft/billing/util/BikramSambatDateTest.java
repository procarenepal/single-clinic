package com.procaresoft.billing.util;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * IRD's CBMS API documentation's own sample payloads give invoice_date as
 * "2074.07.06" — a Bikram Sambat date, dot-separated — not a Gregorian ISO
 * date. Every invoice this backend ever sent to CBMS sent
 * invoice.getInvoiceDate().toString() instead (Gregorian, hyphen-separated),
 * and every single sync attempt was rejected ("104: model invalid") as a
 * result. These pin the conversion this class now performs before that
 * field is ever sent.
 *
 * Verified (not merely trusted) against the original, unmodified upstream
 * algorithm this class is a trimmed port of
 * (https://github.com/medic/bikram-sambat, Apache-2.0), day-by-day across
 * its entire 1914-2090 AD supported range, with zero mismatches — see this
 * class's own doc comment. These test cases are the same ground-truth
 * values that comparison ran against.
 */
class BikramSambatDateTest {

    @Test
    void convertsTheDateThisBugWasFoundOn() {
        // Cross-checked against this app's own frontend nepali-datetime
        // package, run directly (node -e), not read off a screenshot.
        assertEquals("2083.07.02", BikramSambatDate.toBsDateString(LocalDate.of(2026, 10, 19)));
    }

    @Test
    void convertsNepaliNewYearForThreeDifferentYears() {
        // Public, well-known dates: 1 Baishakh (BS New Year) each year.
        assertEquals("2083.01.01", BikramSambatDate.toBsDateString(LocalDate.of(2026, 4, 14)));
        assertEquals("2082.01.01", BikramSambatDate.toBsDateString(LocalDate.of(2025, 4, 14)));
        assertEquals("2081.01.01", BikramSambatDate.toBsDateString(LocalDate.of(2024, 4, 13)));
    }

    @Test
    void matchesTheSamplePayloadDateFormatIrdsOwnDocumentationUses() {
        // IRD's "API to post bill to CBMS" sample: invoice_date="2074.07.06".
        // Confirms the format (dot-separated, zero-padded) independent of
        // whether that specific calendar value is itself right.
        String result = BikramSambatDate.toBsDateString(LocalDate.of(2026, 10, 19));
        assertEquals(10, result.length());
        assertEquals('.', result.charAt(4));
        assertEquals('.', result.charAt(7));
    }

    @Test
    void refusesADateBeforeTheSupportedRange() {
        assertThrows(IllegalArgumentException.class,
                () -> BikramSambatDate.toBsDateString(LocalDate.of(1900, 1, 1)));
    }

    @Test
    void refusesADateAfterTheSupportedRange() {
        assertThrows(IllegalArgumentException.class,
                () -> BikramSambatDate.toBsDateString(LocalDate.of(2200, 1, 1)));
    }
}
