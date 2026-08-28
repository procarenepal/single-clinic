package com.procaresoft.billing.controller;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Every /api/billing/** endpoint must reject unauthenticated requests. This
 * is the fail-closed behavior FirebaseAuthFilter is supposed to guarantee —
 * previously it 401'd EVERYTHING unconditionally (Firebase Admin was never
 * actually configured, see FirebaseConfig), which looked like "working" auth
 * but was actually a silently broken backend. These tests pin down the
 * intended contract: no token -> 401, bogus token -> 401.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class BillingControllerAuthTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void createInvoiceWithoutAuthHeaderIsRejected() throws Exception {
        mockMvc.perform(post("/api/billing/create")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void createInvoiceWithBogusTokenIsRejected() throws Exception {
        mockMvc.perform(post("/api/billing/create")
                        .header("Authorization", "Bearer not-a-real-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void getPatientInvoicesWithoutAuthHeaderIsRejected() throws Exception {
        mockMvc.perform(get("/api/billing/patient/some-patient-id"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void clinicConfigWithoutAuthHeaderIsRejected() throws Exception {
        mockMvc.perform(get("/api/billing/clinic-config"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void retrySyncWithoutAuthHeaderIsRejected() throws Exception {
        mockMvc.perform(post("/api/billing/1/retry-sync")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fiscalYear\":\"2080.081\"}"))
                .andExpect(status().isUnauthorized());
    }
}
