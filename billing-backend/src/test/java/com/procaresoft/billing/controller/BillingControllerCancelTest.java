package com.procaresoft.billing.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.procaresoft.billing.service.CallerAuthorizationService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * IRD's procedure §6(ज): cancelling an invoice must state the reason, and the
 * ledger must reflect it. The reason used to live only in the audit log —
 * these pin that it now lives on the row and comes back with the record.
 */
@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
class BillingControllerCancelTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    private static CallerAuthorizationService.Caller admin() {
        return new CallerAuthorizationService.Caller("admin-uid", "clinic-admin", true, true);
    }

    private String createInvoice(String buyer) throws Exception {
        String body = """
                {
                  "buyerName": "%s",
                  "totalAmount": 113,
                  "taxableAmount": 100,
                  "taxAmount": 13,
                  "exemptAmount": 0,
                  "fiscalYear": "2083.084",
                  "items": [
                    {"itemName": "Consultation", "quantity": 1, "rate": 100, "totalAmount": 100, "isTaxable": true}
                  ]
                }
                """.formatted(buyer);
        MvcResult res = mockMvc.perform(post("/api/billing/create")
                        .requestAttr("clinicId", "default")
                        .requestAttr("userUid", "admin-uid")
                        .requestAttr("caller", admin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(res.getResponse().getContentAsString()).get("invoiceNumber").asText();
    }

    private JsonNode ledgerRow(String invoiceNumber) throws Exception {
        MvcResult res = mockMvc.perform(get("/api/billing/invoice-by-number")
                        .param("invoiceNumber", invoiceNumber)
                        .requestAttr("clinicId", "default")
                        .requestAttr("userUid", "admin-uid")
                        .requestAttr("caller", admin()))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(res.getResponse().getContentAsString());
    }

    @Test
    void cancellationStoresTheReasonOnTheRowItself() throws Exception {
        String number = createInvoice("Cancel Test Patient");
        String id = ledgerRow(number).get("id").asText();

        mockMvc.perform(post("/api/billing/" + id + "/cancel")
                        .requestAttr("clinicId", "default")
                        .requestAttr("userUid", "admin-uid")
                        .requestAttr("caller", admin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"Duplicate entry — patient billed twice\"}"))
                .andExpect(status().isOk());

        JsonNode row = ledgerRow(number);
        assertFalse(row.get("active").asBoolean(), "Is_bill_Active must flip");
        assertEquals("Duplicate entry — patient billed twice", row.get("cancelReason").asText());
        assertEquals("admin-uid", row.get("cancelledByUid").asText());
        assertNotNull(row.get("cancelledAt").asText(null), "cancelledAt must be stamped");
        assertTrue(row.get("cancelledAt").asText().startsWith("20"));
    }

    @Test
    void aLiveRowCarriesNoCancellationFields() throws Exception {
        String number = objectMapper.readTree(
                mockMvc.perform(post("/api/billing/create")
                        .requestAttr("clinicId", "default")
                        .requestAttr("userUid", "admin-uid")
                        .requestAttr("caller", admin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"buyerName":"Live Patient","totalAmount":113,"taxableAmount":100,
                                 "taxAmount":13,"exemptAmount":0,"fiscalYear":"2083.084",
                                 "items":[{"itemName":"Consultation","quantity":1,"rate":100,"totalAmount":100,"isTaxable":true}]}
                                """))
                        .andExpect(status().isOk())
                        .andReturn().getResponse().getContentAsString()).get("invoiceNumber").asText();

        JsonNode row = ledgerRow(number);
        assertTrue(row.get("active").asBoolean());
        assertTrue(row.get("cancelReason").isNull());
        assertTrue(row.get("cancelledAt").isNull());
        assertTrue(row.get("cancelledByUid").isNull());
    }

    @Test
    void cancellingTwiceIsRefused() throws Exception {
        String number = objectMapper.readTree(
                mockMvc.perform(post("/api/billing/create")
                        .requestAttr("clinicId", "default")
                        .requestAttr("userUid", "admin-uid")
                        .requestAttr("caller", admin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"buyerName":"Twice","totalAmount":113,"taxableAmount":100,
                                 "taxAmount":13,"exemptAmount":0,"fiscalYear":"2083.084",
                                 "items":[{"itemName":"Consultation","quantity":1,"rate":100,"totalAmount":100,"isTaxable":true}]}
                                """))
                        .andExpect(status().isOk())
                        .andReturn().getResponse().getContentAsString()).get("invoiceNumber").asText();
        String id = ledgerRow(number).get("id").asText();

        String cancel = "{\"reason\":\"first\"}";
        mockMvc.perform(post("/api/billing/" + id + "/cancel")
                        .requestAttr("clinicId", "default").requestAttr("userUid", "admin-uid")
                        .requestAttr("caller", admin()).contentType(MediaType.APPLICATION_JSON).content(cancel))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/billing/" + id + "/cancel")
                        .requestAttr("clinicId", "default").requestAttr("userUid", "admin-uid")
                        .requestAttr("caller", admin()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"second\"}"))
                .andExpect(status().isConflict());

        // The first reason stands; the refused second attempt must not overwrite it.
        assertEquals("first", ledgerRow(number).get("cancelReason").asText());
    }
}
