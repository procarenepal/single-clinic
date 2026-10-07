package com.procaresoft.billing.service;

import com.procaresoft.billing.service.IrdCbmsService.SyncResult;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * CBMS reports its verdict as an application code in the response body
 * (API documentation, 2079 Ashoj 28). The client used to treat any HTTP
 * 2xx as a successful filing and never read the body, so a rejection
 * delivered with HTTP 200 was recorded as synced. These pin the mapping.
 */
class IrdCbmsResponseInterpretationTest {

    private static SyncResult bill(int http, String body) {
        return IrdCbmsService.interpretCbmsResponse(http, body, false);
    }

    private static SyncResult billReturn(int http, String body) {
        return IrdCbmsService.interpretCbmsResponse(http, body, true);
    }

    @Test
    void bodyCode200IsTheOnlyPlainSuccess() {
        SyncResult r = bill(200, "200");
        assertTrue(r.isSuccess());
        assertEquals("200", r.getResponseCode());
    }

    @Test
    void http200WithBadCredentialsIsAFailure() {
        // The case that motivated this: HTTP says OK, CBMS says the
        // taxpayer login is wrong. Nothing was filed.
        SyncResult r = bill(200, "100");
        assertFalse(r.isSuccess());
        assertEquals("100", r.getResponseCode());
        assertTrue(r.getMessage().contains("credentials"));
    }

    @Test
    void code101OnBillMeansAlreadyFiledAndIsRecordedAsSynced() {
        // A retry of a filing that did land. IRD already holds the number;
        // marking it synced is the correct, idempotent outcome.
        SyncResult r = bill(200, "101");
        assertTrue(r.isSuccess());
        assertEquals("101", r.getResponseCode());
    }

    @Test
    void code101OnBillReturnMeansOriginalUnknownAndIsAFailure() {
        // Same code, opposite meaning on the credit-note endpoint.
        SyncResult r = billReturn(200, "101");
        assertFalse(r.isSuccess());
        assertEquals("101", r.getResponseCode());
    }

    @Test
    void everyOtherDocumentedCodeIsAFailureCarryingItsCode() {
        for (String code : new String[] {"102", "103", "104", "105"}) {
            SyncResult r = bill(200, code);
            assertFalse(r.isSuccess(), code);
            assertEquals(code, r.getResponseCode());
        }
    }

    @Test
    void nonTwoHundredHttpIsAFailureRegardlessOfBody() {
        SyncResult r = bill(500, "200");
        assertFalse(r.isSuccess());
        assertEquals("500", r.getResponseCode());
    }

    @Test
    void twoHundredWithNoRecognisableCodeIsRefusedNotAssumed() {
        // Off-contract. Refusing is the safe direction: the scheduler
        // retries it (bounded) and the failures report shows it.
        assertFalse(bill(200, "").isSuccess());
        assertFalse(bill(200, null).isSuccess());
        assertFalse(bill(200, "<html>Service Unavailable</html>").isSuccess());
        assertEquals("2xx-NOCODE", bill(200, "").getResponseCode());
    }

    @Test
    void toleratesTheWrappersADotNetHostMightAdd() {
        assertTrue(bill(200, "\"200\"").isSuccess());
        assertTrue(bill(200, "  200\n").isSuccess());
        assertTrue(bill(200, "{\"responseCode\":200}").isSuccess());
        assertEquals("104", IrdCbmsService.extractCbmsCode("{\"code\": \"104\", \"msg\": \"model invalid\"}"));
    }

    @Test
    void doesNotMistakeAnAmountOrAYearForACode() {
        // 1130 is an amount, 2083.084 a fiscal year — neither is a code.
        assertNull(IrdCbmsService.extractCbmsCode("total 1130"));
        assertNull(IrdCbmsService.extractCbmsCode("fy 2083.084"));
    }
}
