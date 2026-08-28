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

## Hardening in progress (2026-08-25)

Workstreams 1 & 2 of the IRD compliance hardening plan have landed:

- **Credentials moved server-side.** IRD credentials (`irdApiUsername`/`irdApiPassword`) are no longer sent from the frontend in invoice payloads. They're stored per-clinic in a new encrypted `clinic_ird_config` MySQL table, managed via `PUT/GET /api/billing/clinic-config`, and resolved server-side by `IrdCbmsService`. The Firestore `ClinicSettings.irdApiUsername/irdApiPassword` fields are now legacy and unused by the Java path — migrating the clinic settings UI to the new endpoint and removing them from Firestore is tracked separately.
- **Backend auth actually works now, or fails closed.** `FirebaseAuthFilter` previously 401'd every request unconditionally because no `serviceAccountKey.json` existed anywhere in the repo — the Java backend was silently non-functional. It now loads Firebase Admin credentials from `FIREBASE_SERVICE_ACCOUNT_JSON` or `FIREBASE_SERVICE_ACCOUNT_PATH` env vars (never a committed file) and resolves the caller's `clinicId` server-side from their Firestore `users/{uid}` doc — never from client input. **Until those env vars are set, the backend correctly rejects all billing requests with 401** rather than allowing unauthenticated access.
- **Invoice numbering is now atomic and legally defensible.** Replaced the old in-JVM `synchronized` + "read the last invoice" logic (unsafe across instances, with a non-sequential timestamp fallback) with a `SELECT ... FOR UPDATE`-locked `invoice_sequence` counter, scoped per clinic + Nepali fiscal year, allocated in the same transaction as the invoice save.
- **`DB_PASSWORD` now has no default** — the backend fails to start rather than silently falling back to a committed password.
- **CORS origins are now configurable** via `CORS_ALLOWED_ORIGINS` instead of hardcoded to `localhost:5173`.

Required new environment variables for `billing-backend`: `DB_PASSWORD`, `FIREBASE_SERVICE_ACCOUNT_JSON` (or `FIREBASE_SERVICE_ACCOUNT_PATH`), `IRD_CONFIG_ENC_KEY` (32-byte key, base64 — generate with `openssl rand -base64 32`), and optionally `CORS_ALLOWED_ORIGINS`.

## Java backend consolidation (2026-08-25, Workstream 3)

Per the compliance plan, Java + MySQL is being made the sole authoritative system for invoice creation, sequencing, and IRD submission — retiring the split with Firebase's `irdProxy`. Status by flow:

- **Appointment billing** (`appointmentBillingService.createBilling`) and **pathology billing** (`pathologyBillingService.createBilling`): **done.** Both now call the Java backend FIRST and BLOCKING; the Java-issued invoice number is the one persisted to Firestore (the old Firestore-side `generateInvoiceNumber()` per-clinic counters are no longer used by these two flows — their call sites were removed). A Java/IRD failure now throws and is surfaced to the caller instead of being swallowed by a `console.warn`, so a clinic can no longer end up with a Firestore-only invoice that has no real ledger entry and no number that will ever reach IRD. Verified via `tsc --noEmit`, `mvnw compile`, and the existing test suite.
- **Pharmacy** (`pharmacyService.createMedicinePurchase`): **not yet flipped, left on the old Firestore-first/best-effort pattern.** Reason: the final invoice amounts (net amount, tax, taxable amount) are only known *inside* the Firestore transaction that also does FEFO batch price resolution and stock deduction — they can differ from the amounts on the caller's input. A true "Java-first" call would need either (a) duplicating the batch-pricing logic outside the transaction to call Java with amounts before they're actually resolved (risking a mismatch between what Java/IRD sees and what's actually charged — the exact problem this consolidation is meant to fix), or (b) restructuring to Java-after-Firestore with a compensating rollback (delete the purchase doc, restore stock) if the Java/IRD call fails. This needs its own dedicated pass.
- Backend hardening landed regardless of flow: `IrdSyncLog` (immutable audit table of every IRD submission attempt, request payload with password redacted, response code/body), `Invoice.fiscalYear`/`irdSyncAttempts`/`irdLastAttemptAt`/`irdNeedsManualReview` columns, and `IrdSyncScheduler` re-enabled with exponential backoff (1m/5m/30m/2h/12h) and a 5-attempt cap that flags an invoice `irdNeedsManualReview` instead of retrying forever silently.

Still open: pharmacy flow (above).

## irdProxy hardened, irdService.ts removed (2026-08-25)

- **`src/services/irdService.ts` deleted.** It was a fully-mocked, unused duplicate of the sync logic (confirmed via repo-wide search — nothing imported it) and a risk of an accidental future import of fake "success" responses. Recommendation #1 from this doc is now done.
- **`irdProxy` (Firebase Function) was an open SSRF proxy — now locked down, not yet retired.** Appointment and pathology billing no longer route through it at all (they call the Java backend directly). It's still live for flows not yet migrated (pharmacy, and the legacy fallback branch in `retryIrdSync`), so it couldn't simply be deleted this pass. What changed:
  - It previously accepted `req.body.endpoint` from **any unauthenticated caller** and forwarded arbitrary payloads to that URL — a genuine SSRF hole, not just an internal risk.
  - Now requires a valid Firebase ID token (`Authorization: Bearer ...`, verified via `admin.auth().verifyIdToken`) and only allows `endpoint` values starting with `https://cbapi.ird.gov.np` — real IRD hosts only.
  - The frontend's `syncInvoiceToIRD()` (`src/services/irdCbmsService.ts`) now attaches the current user's ID token to the proxy call; returns a clear "not authenticated" failure if no user is signed in, rather than the request silently 401ing.
- **Found and fixed a real test gap while verifying this**: `irdCbmsService.test.ts`'s mock `ClinicSettings` fixture never set `irdEnvironment`, so it defaulted to `"mock"` and the function returned a fake success *before* ever reaching the proxy call — meaning the 3 tests that claimed to test the real proxy path (success, network failure, negative IRD response) were vacuously passing/failing without exercising that code at all. Fixed the fixture; all 3 now genuinely exercise `axios.post` and assert on its result. Full suite: 103/103 passing.

## Pharmacy migrated (2026-08-25)

Pharmacy's `createMedicinePurchase`/return flow is now on Java/MySQL too, closing the last gap from Workstream 3. Resolution to the amounts-only-known-inside-the-transaction problem flagged earlier: the Firestore transaction still generates its own atomic receipt number (`generatedPurchaseNo`) — that number is now passed to the Java backend via a new `preAssignedInvoiceNumber` field on `InvoiceRequestDto`/`BillingController.create`, instead of letting Java mint a second, competing number. The DB's unique constraint on `invoice_number` remains the collision safety net.

Key difference from appointment/pathology billing: pharmacy's Java call happens **after** the Firestore transaction (stock deduction + purchase record) commits, and a sync failure does **not** throw — by that point the sale has already physically happened (stock deducted), so throwing would misrepresent a completed sale as failed and risk a duplicate-stock-deduction retry. Failure is instead recorded on the purchase record (`irdSynced: false`, `cbmsResponseCode: "SYNC_FAILED"`) and surfaced to the biller as a non-blocking warning toast. The legacy Firebase-proxy `syncInvoiceToIRD` calls in both the sale and return paths were removed (they were duplicate, double-submission-risk paths).

~~**Known residual gap**: `BillingController.create` always calls `IrdCbmsService.syncInvoice(..., isReturn=false)`~~ — checked 2026-08-25, this was already fixed: `InvoiceRequestDto.isReturn` is threaded through `BillingController.createInvoice`/`retryIrdSync` into `syncInvoice`, and `pharmacyService`'s return path sets `isReturn: true` on the payload. No further action needed here.

All three billing flows (appointment, pathology, pharmacy) are now consolidated on Java + MySQL as the sole IRD sync authority. `irdProxy` remains live only for the legacy fallback branch in `retryIrdSync` — full retirement of that function is the one remaining item from Workstream 3.

## Legacy fallback hardened further (2026-08-25)

- **Mock-by-default footgun fixed** in `syncInvoiceToIRD()` (the legacy Firebase-proxy path, still used by `retryIrdSync` for invoices predating the Java migration, i.e. lacking `javaInvoiceId`). Previously `clinicSettings.irdEnvironment || "mock"` meant a clinic that never explicitly configured an environment would get a fake "success" with no network call ever made. It now returns an explicit failure — `"IRD environment is not configured..."` — unless the clinic has set `irdEnvironment` or a manual `irdApiUrl`. An explicit choice of `mock` still works as intended for deliberate testing/demos. Verified via `irdCbmsService.test.ts` (9/9 passing).

## Recommendations

1. ~~Remove or clearly deprecate `src/services/irdService.ts`~~ — **done**, file deleted (2026-08-25).
2. ~~Make the default sync environment fail loudly~~ — **done** (2026-08-25), see above.
3. Pursue IRD sandbox certification and record the outcome (date, correspondence, test results) in this document once complete.
4. Full retirement of the `irdProxy` Firebase Function is still open — it remains load-bearing for retrying invoices created before the Java migration (no `javaInvoiceId`). Retiring it outright would strand those old invoices with no retry path; leave it live (already hardened: auth-required, IRD-host-allowlisted) until those older invoices have aged out or been migrated.
4. Add contract/schema validation tests for the outgoing `IrdBillPayload` against IRD's published CBMS API spec.
5. ~~Decide whether the disabled Java `IrdSyncScheduler` retry job should be removed entirely or re-enabled~~ — **done**, re-enabled with exponential backoff and a manual-review flag after 5 failed attempts (2026-08-25).
6. Migrate pharmacy's `createMedicinePurchase` to the Java-first pattern (see "Java backend consolidation" above for why this needs its own pass), then fully retire `irdProxy` and the legacy fallback branch in `retryIrdSync`.
