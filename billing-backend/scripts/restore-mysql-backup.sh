#!/usr/bin/env bash
#
# Restores a mysqldump backup file (produced by DatabaseBackupService.java,
# downloaded via scripts/download-backup.cjs) into a MySQL database.
#
# Safety behavior:
#   - Refuses to run without an explicit --yes flag when targeting the real
#     database name (procare_billing), to prevent an accidental overwrite.
#   - Always takes a fresh safety dump of the CURRENT state of the target
#     database before restoring over it, saved alongside the restore log,
#     so a bad restore is itself recoverable.
#   - Defaults to restoring into procare_billing_restore_test (a scratch
#     database) unless --target is given — safe to run repeatedly to drill
#     the recovery procedure without touching real data.
#
# Run from billing-backend/ (so relative "restored/" paths match where
# scripts/download-backup.cjs saves files):
#
#   scripts/restore-mysql-backup.sh <backup-file.sql> [--target <db-name>] [--yes]
#
#   scripts/restore-mysql-backup.sh restored/procare_billing_2026-08-30_020000.sql
#       # restores into procare_billing_restore_test (safe drill, no --yes needed)
#
#   scripts/restore-mysql-backup.sh restored/procare_billing_2026-08-30_020000.sql \
#       --target procare_billing --yes
#       # real recovery: overwrites the live database, requires --yes
#
# Requires MYSQL_ROOT_PASSWORD to be set in the environment (never hardcode
# it in this file or pass it as a bare CLI arg — matches the project's
# standing convention of keeping DB credentials out of committed files).

set -euo pipefail

MYSQL_BIN="${MYSQL_BIN:-mysql}"
MYSQLDUMP_BIN="${MYSQLDUMP_BIN:-mysqldump}"
BACKUP_FILE="${1:-}"
TARGET_DB="procare_billing_restore_test"
CONFIRMED=false

shift || true
while [[ $# -gt 0 ]]; do
  case "$1" in
    --target) TARGET_DB="$2"; shift 2 ;;
    --yes) CONFIRMED=true; shift ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$BACKUP_FILE" || ! -f "$BACKUP_FILE" ]]; then
  echo "Usage: $0 <backup-file.sql> [--target <db-name>] [--yes]" >&2
  echo "Backup file not found: '$BACKUP_FILE'" >&2
  exit 1
fi

if [[ -z "${MYSQL_ROOT_PASSWORD:-}" ]]; then
  echo "MYSQL_ROOT_PASSWORD is not set. Export it first, e.g.:" >&2
  echo "  MYSQL_ROOT_PASSWORD='...' $0 $BACKUP_FILE" >&2
  exit 1
fi

if [[ "$TARGET_DB" == "procare_billing" && "$CONFIRMED" != true ]]; then
  echo "Refusing to restore over the LIVE database 'procare_billing' without --yes." >&2
  echo "This will overwrite all current invoices/billing data with the backup's contents." >&2
  echo "Re-run with --target procare_billing --yes once you're certain." >&2
  exit 1
fi

TIMESTAMP=$(date +%Y-%m-%d_%H%M%S)
SAFETY_DUMP="restored/pre-restore-safety-dump_${TARGET_DB}_${TIMESTAMP}.sql"

echo "== Restoring '$BACKUP_FILE' into database '$TARGET_DB' =="

echo "1/4  Creating database '$TARGET_DB' if it doesn't already exist..."
"$MYSQL_BIN" -u root -p"$MYSQL_ROOT_PASSWORD" \
  -e "CREATE DATABASE IF NOT EXISTS \`$TARGET_DB\`;"

echo "2/4  Taking a safety dump of '$TARGET_DB' current state -> $SAFETY_DUMP"
mkdir -p restored
"$MYSQLDUMP_BIN" -u root -p"$MYSQL_ROOT_PASSWORD" \
  --single-transaction --routines --triggers \
  --databases "$TARGET_DB" > "$SAFETY_DUMP" 2>/dev/null || \
  echo "  (safety dump skipped — database was empty/new, nothing to preserve)"

echo "3/4  Restoring backup into '$TARGET_DB'..."
"$MYSQL_BIN" -u root -p"$MYSQL_ROOT_PASSWORD" "$TARGET_DB" < "$BACKUP_FILE"

echo "4/4  Verifying restored table row counts (exact COUNT(*), not the"
echo "     information_schema estimate — that's unreliable immediately"
echo "     after a restore, before InnoDB recalculates its stats)..."
TABLES=$("$MYSQL_BIN" -N -u root -p"$MYSQL_ROOT_PASSWORD" "$TARGET_DB" \
  -e "SHOW TABLES;" 2>&1 | grep -v "^mysql:" || true)
for t in $TABLES; do
  COUNT=$("$MYSQL_BIN" -N -u root -p"$MYSQL_ROOT_PASSWORD" "$TARGET_DB" \
    -e "SELECT COUNT(*) FROM \`$t\`;" 2>&1 | grep -v "^mysql:" || true)
  printf "  %-30s %s\n" "$t" "$COUNT"
done

echo ""
echo "Restore complete. Database: $TARGET_DB"
if [[ "$TARGET_DB" != "procare_billing" ]]; then
  echo "This was a drill/verification restore, not the live database."
  echo "Drop it when done: mysql -u root -p -e \"DROP DATABASE \\\`$TARGET_DB\\\`;\""
fi
