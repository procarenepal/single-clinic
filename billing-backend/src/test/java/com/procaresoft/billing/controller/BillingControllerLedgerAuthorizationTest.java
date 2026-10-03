package com.procaresoft.billing.controller;

import com.procaresoft.billing.service.CallerAuthorizationService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Authentication is not authorization, and for a long time this API only had
 * the former: it established who you were and that you belonged to a clinic,
 * then let you do anything to the ledger. Every role restriction in the product
 * lived in the browser and in firestore.rules, both of which this API bypasses,
 * so any signed-in user could create invoices, draw numbers from the IRD
 * sequence, void an invoice or rewrite its IRD sync state by calling it
 * directly.
 *
 * These tests pin the two tiers that now apply. The caller is supplied as a
 * request attribute, which is what FirebaseAuthFilter attaches after resolving
 * the user's role assignments, so the guards can be exercised without standing
 * up Firebase.
 */
@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
class BillingControllerLedgerAuthorizationTest {

    @Autowired
    private MockMvc mockMvc;

    private static CallerAuthorizationService.Caller caller(boolean admin, boolean mayWrite) {
        return new CallerAuthorizationService.Caller("uid-under-test",
                admin ? "clinic-admin" : "staff", admin, mayWrite);
    }

    // ---- tier 1: writing to the ledger at all ----

    @Test
    void reserveNumberIsRefusedToACallerWithNoBillingAccess() throws Exception {
        mockMvc.perform(post("/api/billing/reserve-number")
                        .requestAttr("clinicId", "default")
                        .requestAttr("userUid", "uid-under-test")
                        .requestAttr("caller", caller(false, false))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fiscalYear\":\"2083.084\"}"))
                .andExpect(status().isForbidden());
    }

    /**
     * A VALID body on purpose. Bean validation of @Valid @RequestBody runs
     * during argument resolution, before the handler body and therefore before
     * the authorization guard — so an unauthorized caller sending nonsense gets
     * 400 rather than 403. The write still never happens either way, but the
     * guard is only actually reached once the body parses, and this test must
     * exercise the guard rather than the validator.
     */
    @Test
    void createInvoiceIsRefusedToACallerWithNoBillingAccess() throws Exception {
        String validBody = """
                {
                  "buyerName": "Test Patient",
                  "totalAmount": 100,
                  "taxableAmount": 0,
                  "taxAmount": 0,
                  "exemptAmount": 100,
                  "fiscalYear": "2083.084",
                  "items": [
                    {"itemName": "Thing", "quantity": 1, "rate": 100, "totalAmount": 100}
                  ]
                }
                """;

        mockMvc.perform(post("/api/billing/create")
                        .requestAttr("clinicId", "default")
                        .requestAttr("userUid", "uid-under-test")
                        .requestAttr("caller", caller(false, false))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validBody))
                .andExpect(status().isForbidden());
    }

    @Test
    void aMissingCallerIsRefusedRatherThanWavedThrough() throws Exception {
        // Fail closed: if the filter did not attach an answer, the request
        // must not be treated as permitted.
        mockMvc.perform(post("/api/billing/reserve-number")
                        .requestAttr("clinicId", "default")
                        .requestAttr("userUid", "uid-under-test")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fiscalYear\":\"2083.084\"}"))
                .andExpect(status().isForbidden());
    }

    // ---- tier 2: changing what the tax authority has been told ----

    @Test
    void retrySyncIsRefusedToANonAdministratorEvenWithBillingAccess() throws Exception {
        // Billing staff raise invoices; they do not get to re-tell IRD what
        // an invoice's state is.
        mockMvc.perform(post("/api/billing/1/retry-sync")
                        .requestAttr("clinicId", "default")
                        .requestAttr("userUid", "uid-under-test")
                        .requestAttr("caller", caller(false, true))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fiscalYear\":\"2083.084\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void cancelIsRefusedToANonAdministratorEvenWithBillingAccess() throws Exception {
        mockMvc.perform(post("/api/billing/1/cancel")
                        .requestAttr("clinicId", "default")
                        .requestAttr("userUid", "uid-under-test")
                        .requestAttr("caller", caller(false, true))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"test\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void sourcePointerIsRefusedToANonAdministrator() throws Exception {
        mockMvc.perform(post("/api/billing/1/source-pointer")
                        .requestAttr("clinicId", "default")
                        .requestAttr("userUid", "uid-under-test")
                        .requestAttr("caller", caller(false, true))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"sourceCollection\":\"appointmentBilling\",\"sourceDocId\":\"x\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void anAdministratorIsNotStoppedByEitherTier() throws Exception {
        // Reaches the handler rather than being refused: the invoice does not
        // exist in the test database, so anything other than 403 shows the
        // guards let an administrator through.
        mockMvc.perform(post("/api/billing/999999/cancel")
                        .requestAttr("clinicId", "default")
                        .requestAttr("userUid", "uid-under-test")
                        .requestAttr("caller", caller(true, true))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"test\"}"))
                .andExpect(status().isNotFound());
    }
}
