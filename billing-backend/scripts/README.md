# Backup & Recovery

Satisfies IRD Electronic Invoice Procedure clause 6(ग) — "auto log/archive of
all DB actions, backup, and recovery." The backup half was already
automated (`DatabaseBackupService.java`); this directory adds the recovery
half: a tested, documented way to actually restore one.

## How backups happen (already running, no action needed)

`DatabaseBackupService` runs a nightly cron job (`backup.cron`, default
2 AM) inside `billing-backend`: `mysqldump`s the full `procare_billing`
database and uploads it to Firebase Storage at `mysql-backups/procare_billing_<timestamp>.sql`.
Client access to that path is denied by `storage.rules` (clause 6(ढ)) —
only someone with the Firebase project-owner service account
(`billing-backend/secrets/serviceAccountKey.json`) can retrieve a backup.
That's deliberate: backups contain full raw patient/billing data.

## How to recover

### 1. Download a backup

```bash
cd billing-backend
npm install --no-save firebase-admin   # from the repo root if not already installed
node scripts/download-backup.cjs --list        # see what's available
node scripts/download-backup.cjs                # download the newest one
node scripts/download-backup.cjs <filename.sql> # or a specific one
```

Saves to `billing-backend/restored/<filename>.sql`.

### 2. Restore it

```bash
export MYSQL_ROOT_PASSWORD='...'   # never hardcode this anywhere
scripts/restore-mysql-backup.sh restored/procare_billing_<timestamp>.sql
```

By default this restores into a **scratch database**
(`procare_billing_restore_test`), not the live one — safe to run any time
to drill the procedure or verify a specific backup is actually restorable,
without any risk to real data. It prints row counts per table at the end so
you can eyeball that the restore actually contains data.

To perform a **real recovery** (overwrite the live database with a
backup — only do this during an actual incident):

```bash
scripts/restore-mysql-backup.sh restored/procare_billing_<timestamp>.sql \
  --target procare_billing --yes
```

This still takes a safety dump of whatever's currently in `procare_billing`
*before* overwriting it (saved to `restored/pre-restore-safety-dump_*.sql`),
so a bad restore is itself recoverable.

### 3. After a real restore

- Restart `billing-backend` (it caches nothing DB-schema-related across a
  restore, but a restart confirms the app reconnects cleanly).
- Spot-check a few recent invoices in the app match what you expect.
- If the restored backup predates the incident, anything created between
  the backup and the incident is genuinely gone — that's the backup
  interval's inherent limit (currently nightly), not a bug in this
  procedure.

## Verified working

This procedure was tested end-to-end on 2026-08-30: a fresh `mysqldump` of
`procare_billing` was taken, restored into `procare_billing_restore_test`
via this script, and the row counts were confirmed to match the source
database before the test database was dropped. See project memory
(`ird_compliance_progress`) for the verification log.

# CBMS Live API Test

`scripts/test-cbms-live.sh` — a standalone demonstration script for showing
an IRD officer that the CBMS integration actually works against IRD's real
API, live, on request (not just described on paper).

```bash
scripts/test-cbms-live.sh
```

By default it uses IRD's own published developer test credentials from
`IRD Documents/ird_api_documentation.pdf` (`Test_CBMS` / seller_pan
`999999999`) — safe to run repeatedly, doesn't touch this clinic's real
filing. It posts a fresh invoice to `/api/bill`, re-submits the same invoice
number to confirm duplicate rejection, then posts a credit note against it
to `/api/billreturn` — printing a clear PASS/FAIL line and the raw response
code for each step. Verified working live on 2026-08-31 (3/3 passed).

To demonstrate against this clinic's real taxpayer credentials instead of
IRD's shared test login:

```bash
CBMS_USERNAME='...' CBMS_PASSWORD='...' CBMS_SELLER_PAN='...' \
CBMS_BUYER_PAN='...' scripts/test-cbms-live.sh
```
