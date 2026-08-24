# IRD CBMS Integration

## Overview

ProCareSoft integrates with Nepal's Inland Revenue Department (IRD) **Central Billing Monitoring System (CBMS)**, which requires real-time reporting of sales invoices to IRD as they are finalized. This document describes how that integration is implemented across the frontend, the Firebase backend, and the Spring Boot billing backend, and what its current maturity/certification status is.

> **Status: Functionally implemented, NOT IRD-certified.** The code talks to real IRD sandbox/live endpoints with correct payload shape and Nepali fiscal-year handling, but there is no record in this repository of IRD Nepal having certified or signed off on the integration. Treat it as pre-production until that certification is obtained. See [Certification Status](#certification-status) below.

## Architecture

### Core Components

1. **Tax Calculation Engine** — [`src/utils/taxEngine.ts`](../src/utils/taxEngine.ts)
2. **Active Sync Service** — [`src/services/irdCbmsService.ts`](../src/services/irdCbmsService.ts)
3. **Legacy/Unused Sync Service** — [`src/services/irdService.ts`](../src/services/irdService.ts) (fully mocked, not imported anywhere — candidate for removal)
4. **Annexure Report UI** — [`src/pages/dashboard/reports/IrdAnnexureReport.tsx`](../src/pages/dashboard/reports/IrdAnnexureReport.tsx)
5. **Java Sync Path** — [`billing-backend/src/main/java/com/procaresoft/billing/service/IrdCbmsService.java`](../billing-backend/src/main/java/com/procaresoft/billing/service/IrdCbmsService.java) + `IrdSyncScheduler.java`
6. **Firebase Functions Proxy** — `irdProxy` Cloud Function (avoids browser CORS/credential exposure)
7. **Clinic Settings Schema** — `irdEnabled`, `irdEnvironment`, `irdApiUrl`, `irdApiUsername`, `irdApiPassword` on `ClinicSettings`/`Clinic` (see `src/types/models.ts`)

### Data Flow

```
Invoice finalized (appointment / pathology / pharmacy billing)
        │
        ▼
calculateTaxBreakdown()  (src/utils/taxEngine.ts)
        │  → subtotal, taxableAmount, taxAmount, exemptAmount, totalAmount
        ▼
syncInvoiceToIRD()  (src/services/irdCbmsService.ts)
        │  → builds IrdBillPayload, resolves environment, chooses endpoint
        ▼
   ┌────────────┬──────────────────┬───────────────────┐
   │  mock mode │  Firebase proxy  │  Java backend      │
   │ (default)  │  (irdProxy fn)   │  (billingApi call) │
   └────────────┴──────────────────┴───────────────────┘
        │                │                    │
   logs + fake        POST to             POST to
   success             /api/bill or        /api/bill or
                       /api/billreturn     /api/billreturn
                       via Cloud Function  via RestTemplate
                                           (billing-backend)
        │                │                    │
        └────────────────┴────────────────────┘
                         ▼
        Result written back to invoice record:
        irdSynced, irdSyncDate, cbmsResponseCode
                         ▼
        auditLogService.logIrdSync() (success or failure)
```

## Tax Calculation

`calculateTaxBreakdown()` in [`src/utils/taxEngine.ts`](../src/utils/taxEngine.ts) is the single source of truth for VAT math, used before any IRD payload is built:

- Applies **item-level discounts** first (flat or percent), then a **main invoice-level discount** allocated *pro-rata* between taxable and exempt subtotals.
- Computes VAT at a configurable rate (default **13%**, the standard Nepal VAT rate) on the net taxable amount only.
- Items are only taxable if both the clinic's `isTaxEnabled` setting and the item's own `isTaxable` flag are true — this models VAT-exempt medical services vs. taxable goods (e.g. pharmacy items).
- All monetary outputs are rounded to 2 decimal places.

## Fiscal Year & Date Handling

`getNepaliFiscalYear()` converts a Gregorian date to the Nepali fiscal-year format IRD expects (e.g. `"2080.081"`), using the `nepali-datetime` library. The Nepali fiscal year starts in **Shrawan** (the 4th Bikram Sambat month), so a date in months 1–3 belongs to the *previous* fiscal year.

`formatIrdDate()` formats dates as `YYYY.MM.DD` per the IRD API spec.

## Sync Environments

`clinicSettings.irdEnvironment` selects the target endpoint:

| Environment | Base URL | Behavior |
|---|---|---|
| `live` | `https://cbapi.ird.gov.np` | Real production IRD endpoint |
| `sandbox` | `https://cbapi.ird.gov.np/sandbox` | IRD's test endpoint |
| `mock` (default when unset) | `"mock"` | No network call — logs payload to console, always returns a fake success |

A manual `clinicSettings.irdApiUrl` override takes precedence over the environment default. **Because `mock` is the default when `irdEnvironment` is not explicitly set, a clinic that hasn't been configured will silently "succeed" without ever contacting IRD** — this is convenient for demos/testing but is a footgun for a clinic administrator who assumes sync is live. See [Recommendations](#recommendations).

## Two Sync Paths: Firebase vs. Java Backend

`retryIrdSync()` in `irdCbmsService.ts` branches on whether the invoice has a `javaInvoiceId`:

- **Has `javaInvoiceId`** → routed through the Spring Boot `billing-backend` via `billingApi.retryIrdSync()`, which calls `IrdCbmsService.java`'s `RestTemplate`-based POST directly to IRD (bypassing the Firebase proxy).
- **No `javaInvoiceId`** (legacy path) → goes through `syncInvoiceToIRD()` → Firebase Functions `irdProxy` → IRD.

Both paths converge on the same result shape (`success`, `responseCode`, `message`) and both write back `irdSynced` / `irdSyncDate` / `cbmsResponseCode` onto the originating invoice record (appointment billing, pathology billing, or pharmacy purchase), then log the attempt via `auditLogService.logIrdSync()`.

The Java backend also has a `@Scheduled` job (`IrdSyncScheduler.retryFailedIrdSyncs`) intended to auto-retry failed syncs every 60 seconds, but it is currently **disabled** (`if (true) return;` at the top of the method) — retries are handled manually via Firestore + UI retry buttons instead ("Option A" per the inline comment).

## Annexure Reporting

[`src/pages/dashboard/reports/IrdAnnexureReport.tsx`](../src/pages/dashboard/reports/IrdAnnexureReport.tsx) provides the periodic (monthly/annual) tax annexure report clinics need for IRD filing, built from finalized invoice data rather than the real-time sync stream itself.

## Certification Status

No file in this repository (README, CHANGELOG, or otherwise) documents official IRD certification, sandbox test sign-off, or go-live approval for this integration. Evidence found:

- Real production and sandbox IRD hostnames are hardcoded, indicating genuine integration intent, not just a stub.
- The Java backend's inline comments (`// Mock logic removed for production`, appearing twice in `IrdCbmsService.java`) suggest mock scaffolding was recently stripped in preparation for real use — i.e. this is being actively hardened, not finished.
- No automated test validates outgoing payloads against IRD's official CBMS schema (only `irdCbmsService.test.ts`, a frontend unit test of internal logic).
- `irdService.ts` — an older, fully mocked duplicate of the sync logic — is still present and unused, which is a sign the integration was mid-refactor when work paused.

**Do not represent this system as "IRD certified" until certification is obtained through IRD Nepal's official process and evidence of that (a certificate, sandbox acceptance report, or IRD correspondence) is retained.**

## Recommendations

1. Remove or clearly deprecate `src/services/irdService.ts` — its presence alongside the real implementation risks a future accidental import of mocked "success" responses.
2. Make the default sync environment fail loudly (or require an explicit choice) rather than silently defaulting to `mock`, so unconfigured clinics don't mistake mock success for a real sync.
3. Pursue IRD sandbox certification and record the outcome (date, correspondence, test results) in this document once complete.
4. Add contract/schema validation tests for the outgoing `IrdBillPayload` against IRD's published CBMS API spec.
5. Decide whether the disabled Java `IrdSyncScheduler` retry job should be removed entirely or re-enabled, rather than left as dead code with a `if (true) return;` guard.
