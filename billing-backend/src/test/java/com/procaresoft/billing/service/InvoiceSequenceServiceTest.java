package com.procaresoft.billing.service;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Covers the exact bug this service was built to fix: the old
 * synchronized/read-last-invoice approach was not safe across concurrent
 * requests. These tests assert the SELECT ... FOR UPDATE-backed counter
 * produces unique, gapless, sequential numbers under real concurrency.
 */
@SpringBootTest
@ActiveProfiles("test")
class InvoiceSequenceServiceTest {

    @Autowired
    private InvoiceSequenceService invoiceSequenceService;

    @Autowired
    private PlatformTransactionManager transactionManager;

    private String generateInTransaction(String clinicId, String fiscalYear) {
        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        return tx.execute(status -> invoiceSequenceService.generateNextInvoiceNumber(clinicId, fiscalYear));
    }

    @Test
    void sequentialCallsProduceGaplessIncrementingNumbers() {
        String clinicId = "clinic-sequential-" + System.nanoTime();
        String fiscalYear = "2080.081";

        assertEquals("INV-2080.081-0001", generateInTransaction(clinicId, fiscalYear));
        assertEquals("INV-2080.081-0002", generateInTransaction(clinicId, fiscalYear));
        assertEquals("INV-2080.081-0003", generateInTransaction(clinicId, fiscalYear));
    }

    @Test
    void differentClinicsHaveIndependentSequences() {
        String fiscalYear = "2080.081";
        String clinicA = "clinic-a-" + System.nanoTime();
        String clinicB = "clinic-b-" + System.nanoTime();

        assertEquals("INV-2080.081-0001", generateInTransaction(clinicA, fiscalYear));
        assertEquals("INV-2080.081-0001", generateInTransaction(clinicB, fiscalYear));
        assertEquals("INV-2080.081-0002", generateInTransaction(clinicA, fiscalYear));
    }

    @Test
    void concurrentRequestsForSameClinicFiscalYearNeverCollideOrGap() throws Exception {
        String clinicId = "clinic-concurrent-" + System.nanoTime();
        String fiscalYear = "2080.081";
        int concurrentRequests = 25;

        ExecutorService pool = Executors.newFixedThreadPool(10);
        try {
            List<Callable<String>> tasks = new java.util.ArrayList<>();
            for (int i = 0; i < concurrentRequests; i++) {
                tasks.add(() -> generateInTransaction(clinicId, fiscalYear));
            }

            List<Future<String>> futures = pool.invokeAll(tasks);
            Set<String> allNumbers = new HashSet<>();
            for (Future<String> f : futures) {
                allNumbers.add(f.get());
            }

            // No two concurrent requests were handed the same invoice number.
            assertEquals(concurrentRequests, allNumbers.size(), "Expected all invoice numbers to be unique");

            // Gapless: numbers 0001..0025 all present, nothing skipped.
            for (int i = 1; i <= concurrentRequests; i++) {
                String expected = "INV-2080.081-" + String.format("%04d", i);
                assertTrue(allNumbers.contains(expected), "Missing expected sequential number: " + expected);
            }
        } finally {
            pool.shutdown();
        }
    }

    @Test
    void rejectsMissingClinicId() {
        assertThrows(IllegalArgumentException.class,
                () -> generateInTransaction(null, "2080.081"));
    }

    @Test
    void rejectsMalformedFiscalYear() {
        assertThrows(IllegalArgumentException.class,
                () -> generateInTransaction("clinic-x", "not-a-fiscal-year"));
    }
}
