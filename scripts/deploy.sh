#!/usr/bin/env bash
#
# Deploy runbook for the production VPS (frontend + optional backend).
#
# Codifies a process that was previously run by hand, one command at a
# time, across many sessions — and caused three real (if brief) production
# incidents along the way:
#   1. Checking a piped command's exit code reflects the LAST command in
#      the pipe, not scp's. `scp ... | tail -20; echo $?` printed "0" even
#      though scp's own output, further up, read "Connection reset by
#      peer" mid-transfer — 62 files never arrived, and the prune step
#      (correctly, given what it could see) deleted their now-orphaned
#      previous versions, including the live index.html's own entry
#      bundle. Brief outage: blank page / failed JS load.
#   2. The prune step used `comm -13` on two sorted file lists. `comm`
#      collates by the CURRENT LOCALE, independent of how the inputs were
#      sorted — two lists sorted identically by `LC_ALL=C sort` on both
#      ends were STILL misclassified, because `comm` re-sorts internally
#      for comparison. It silently deleted 5, then later 17, live files
#      whose names happened to collate differently under the runner's
#      locale (`_` vs `.` are a classic case). `comm` must never be used
#      for this; grep -vxF -f (plain line-equality, no collation) is the
#      replacement throughout this script.
#   3. `curl / ` returning 200 and `/api/...` returning 401 are NOT proof
#      a deploy succeeded — nginx's SPA fallback happily serves the STALE
#      index.html (200) for a route whose real JS file is missing. The
#      live entry-bundle hash must be compared against the fresh local
#      build, and it must happen BEFORE any prune, not just at the end.
#
# Every stage below is independently runnable and, except `prune` itself,
# non-destructive — this is deliberately NOT a single "deploy and clean up"
# command. Review each stage's output before running the next.
#
# Usage:
#   scripts/deploy.sh build            Production frontend build, verified
#   scripts/deploy.sh backend-build    mvn package (only if Java changed)
#   scripts/deploy.sh backup           Snapshot the live dist/ (+ jar)
#   scripts/deploy.sh upload           scp dist/ to the server (merges, no deletes)
#   scripts/deploy.sh verify-upload    Exact filename diff + entry-hash check
#   scripts/deploy.sh prune-dry-run    Show what prune WOULD delete
#   scripts/deploy.sh prune            Actually delete stale remote assets (confirms first)
#   scripts/deploy.sh backend-upload   scp the jar + restart the service
#   scripts/deploy.sh verify-live      Site/API health + entry hash + content-type probe
#   scripts/deploy.sh full             build -> backup -> upload -> verify-upload,
#                                       then STOPS — prune is always a separate,
#                                       deliberate step
#
# Config (env vars, all overridable — defaults match this clinic's own
# production server, not a secret: the IP resolves publicly from the
# domain's own DNS/TLS records). The SSH private key file itself is never
# read from or written into this repo.
#   DEPLOY_HOST        default: 103.160.22.120
#   DEPLOY_USER        default: root
#   DEPLOY_KEY         default: $HOME/.ssh/skincare_billing
#   DEPLOY_REMOTE_DIR  default: /opt/procare
#   DEPLOY_DOMAIN      default: skincarehospital.com
#   DEPLOY_JAR_NAME    default: billing-backend-0.0.1-SNAPSHOT.jar
#
set -euo pipefail

DEPLOY_HOST="${DEPLOY_HOST:-103.160.22.120}"
DEPLOY_USER="${DEPLOY_USER:-root}"
DEPLOY_KEY="${DEPLOY_KEY:-$HOME/.ssh/skincare_billing}"
DEPLOY_REMOTE_DIR="${DEPLOY_REMOTE_DIR:-/opt/procare}"
DEPLOY_DOMAIN="${DEPLOY_DOMAIN:-skincarehospital.com}"
DEPLOY_JAR_NAME="${DEPLOY_JAR_NAME:-billing-backend-0.0.1-SNAPSHOT.jar}"

HOST_STR="${DEPLOY_USER}@${DEPLOY_HOST}"
API_URL="https://${DEPLOY_DOMAIN}/api/billing"
SITE_URL="https://${DEPLOY_DOMAIN}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

ts() { date +%Y%m%d%H%M%S; }

ssh_cmd() { ssh -i "$DEPLOY_KEY" "$HOST_STR" "$@"; }

require_dist() {
  if [ ! -d dist ]; then
    echo "No dist/ directory — run 'build' first." >&2
    exit 1
  fi
}

# ── build ────────────────────────────────────────────────────────────────
cmd_build() {
  echo "==> Building frontend for production (API URL: $API_URL)"
  echo "VITE_BILLING_API_URL=${API_URL}" > .env.production.local
  # Runs even if the build below fails — the override must never be left
  # behind (it's gitignored, but a stray one has confused a later local
  # `npm run dev` before).
  trap 'rm -f .env.production.local' EXIT

  npx vite build --mode production

  echo "==> Verifying the API URL is baked in, and no localhost leaked through"
  if ! grep -rl "${DEPLOY_DOMAIN}/api/billing" dist/assets/*.js > /dev/null 2>&1; then
    echo "ERROR: ${DEPLOY_DOMAIN}/api/billing not found anywhere in dist/assets/*.js." >&2
    echo "The production override did not take — do not deploy this build." >&2
    exit 1
  fi
  if grep -rl "localhost:8080" dist/assets/*.js > /dev/null 2>&1; then
    echo "ERROR: localhost:8080 found in the production build output." >&2
    exit 1
  fi
  echo "OK — build verified clean."
}

# ── backend-build ────────────────────────────────────────────────────────
cmd_backend_build() {
  echo "==> Building billing-backend (mvn package, tests skipped)"
  (cd billing-backend && ./mvnw -q -DskipTests package)
  echo "OK — billing-backend/target/${DEPLOY_JAR_NAME}"
}

# ── backup ───────────────────────────────────────────────────────────────
cmd_backup() {
  local stamp
  stamp="$(ts)"
  echo "==> Backing up the live dist/ on the server (timestamp $stamp)"
  ssh_cmd "cp -r ${DEPLOY_REMOTE_DIR}/dist ${DEPLOY_REMOTE_DIR}/dist.backup-${stamp}"
  if ssh_cmd "test -f ${DEPLOY_REMOTE_DIR}/billing-backend/target/${DEPLOY_JAR_NAME}"; then
    ssh_cmd "cp ${DEPLOY_REMOTE_DIR}/billing-backend/target/${DEPLOY_JAR_NAME} ${DEPLOY_REMOTE_DIR}/billing-backend/target/${DEPLOY_JAR_NAME}.backup-${stamp}"
  fi
  echo "OK — backup suffix: ${stamp} (rollback: cp -r dist.backup-${stamp} dist)"
}

# ── upload ───────────────────────────────────────────────────────────────
cmd_upload() {
  require_dist
  local log
  log="/tmp/procare-deploy-upload-$(ts).log"
  echo "==> Uploading dist/ to ${HOST_STR}:${DEPLOY_REMOTE_DIR}/dist/ (merge, not replace)"
  echo "    log: $log"

  # Never pipe scp's output through anything — in a pipeline, $? reflects
  # the LAST command, not scp's. Redirect to a file and check scp's own
  # exit status directly.
  set +e
  scp -i "$DEPLOY_KEY" -r dist/. "${HOST_STR}:${DEPLOY_REMOTE_DIR}/dist/" > "$log" 2>&1
  local status=$?
  set -e

  if [ $status -ne 0 ]; then
    echo "ERROR: scp exited $status. See $log." >&2
    exit 1
  fi
  # A clean exit code is not sufficient on its own — a reset mid-transfer
  # has been observed to still coincide with scp exiting 0 at the very
  # end. Check its own output text explicitly.
  if grep -qi "connection reset\|connection closed" "$log"; then
    echo "ERROR: scp exited 0 but its output mentions a connection reset/closed." >&2
    echo "This exact pattern caused a real partial-transfer incident before. Do not" >&2
    echo "trust this upload — run 'verify-upload' before anything else, and if it" >&2
    echo "finds missing files, re-run 'upload' (it merges, safe to repeat)." >&2
    exit 1
  fi
  echo "OK — upload completed with no errors in the transfer log."
  echo "Run 'verify-upload' next — do NOT prune before it passes."
}

# ── verify-upload ────────────────────────────────────────────────────────
cmd_verify_upload() {
  require_dist
  echo "==> Comparing local vs. remote dist/assets filenames"
  ls dist/assets > /tmp/procare-deploy-local-assets.txt
  ssh_cmd "cd ${DEPLOY_REMOTE_DIR}/dist/assets && ls" > /tmp/procare-deploy-remote-assets.txt

  # grep -vxF -f: exact line match, no sorting or collation involved —
  # see the header comment on why `comm` must never be used here.
  local missing
  missing="$(grep -vxF -f /tmp/procare-deploy-remote-assets.txt /tmp/procare-deploy-local-assets.txt || true)"
  if [ -n "$missing" ]; then
    echo "ERROR: these local files are NOT on the server yet — upload incomplete:" >&2
    echo "$missing" >&2
    echo "Re-run 'upload' (safe to repeat, it merges) before continuing." >&2
    exit 1
  fi
  echo "OK — every local asset is present on the server."

  echo "==> Checking the live entry bundle against the fresh local build"
  echo "    (this is the one check that catches a corrupted/partial deploy —"
  echo "     site-200 and api-401 do not; nginx serves the stale index.html"
  echo "     for a missing asset too.)"
  local local_entry live_entry
  local_entry="$(grep -oE 'index-[A-Za-z0-9_-]+\.js' dist/index.html | head -1)"
  live_entry="$(curl -s "$SITE_URL/" | grep -oE 'index-[A-Za-z0-9_-]+\.js' | head -1)"
  if [ "$local_entry" != "$live_entry" ]; then
    echo "ERROR: live entry bundle ($live_entry) != local build ($local_entry)." >&2
    echo "The deploy has not fully taken effect yet. Possible causes: index.html" >&2
    echo "itself hasn't uploaded (it sorts after assets/ alphabetically — run" >&2
    echo "'upload' again), or there's a reverse-proxy cache in front of nginx." >&2
    echo "DO NOT PRUNE until this matches." >&2
    exit 1
  fi
  echo "OK — live entry bundle matches: $live_entry"
  echo ""
  echo "Safe to run 'prune-dry-run' next."
}

# ── prune-dry-run / prune ────────────────────────────────────────────────
_prune_list() {
  ls dist/assets > /tmp/procare-deploy-local-assets.txt
  ssh_cmd "cd ${DEPLOY_REMOTE_DIR}/dist/assets && ls" > /tmp/procare-deploy-remote-assets.txt
  grep -vxF -f /tmp/procare-deploy-local-assets.txt /tmp/procare-deploy-remote-assets.txt || true
}

cmd_prune_dry_run() {
  require_dist
  echo "==> Remote files NOT in the local build (what 'prune' would delete):"
  local stale
  stale="$(_prune_list)"
  if [ -z "$stale" ]; then
    echo "(none — nothing to prune)"
  else
    echo "$stale"
  fi
}

cmd_prune() {
  require_dist
  echo "==> This will DELETE the following files from the production server:"
  local stale
  stale="$(_prune_list)"
  if [ -z "$stale" ]; then
    echo "(none — nothing to prune)"
    return 0
  fi
  echo "$stale"
  echo ""
  echo "Only old-hash files from a previous build should appear above — if"
  echo "anything else is in that list, STOP and investigate before confirming."
  read -r -p "Type 'yes' to delete these files on the server: " confirm
  if [ "$confirm" != "yes" ]; then
    echo "Aborted — nothing deleted."
    exit 1
  fi
  echo "$stale" > /tmp/procare-deploy-prune-list.txt
  scp -i "$DEPLOY_KEY" /tmp/procare-deploy-prune-list.txt "${HOST_STR}:/tmp/procare-deploy-prune-list.txt"
  ssh_cmd "cd ${DEPLOY_REMOTE_DIR}/dist/assets && xargs -r rm -f -- < /tmp/procare-deploy-prune-list.txt && ls | wc -l"
  echo "OK — pruned. Run 'verify-live' to confirm the site is healthy."
}

# ── backend-upload ───────────────────────────────────────────────────────
cmd_backend_upload() {
  local jar="billing-backend/target/${DEPLOY_JAR_NAME}"
  if [ ! -f "$jar" ]; then
    echo "ERROR: $jar not found — run 'backend-build' first." >&2
    exit 1
  fi
  echo "==> Uploading $jar and restarting the service"
  scp -i "$DEPLOY_KEY" "$jar" "${HOST_STR}:${DEPLOY_REMOTE_DIR}/billing-backend/target/${DEPLOY_JAR_NAME}"
  ssh_cmd "systemctl restart procare-billing && sleep 8 && systemctl is-active procare-billing"
  echo "OK — service restarted and active."
}

# One asset's content-type check, run in parallel by cmd_verify_live below.
# A plain function (not an inline string handed to `bash -c`) so the xargs
# call site stays simple and the quoting can't go subtly wrong.
_deploy_check_asset_content_type() {
  local path="$1" name ct
  name="$(basename "$path")"
  ct="$(curl -s -o /dev/null -w "%{content_type}" "${SITE_URL}/assets/${name}")"
  case "$ct" in
    *javascript*) ;;
    *) echo "BAD: $name served as '$ct'" ;;
  esac
}
export -f _deploy_check_asset_content_type
export SITE_URL

# ── verify-live ──────────────────────────────────────────────────────────
cmd_verify_live() {
  require_dist
  local failed=0

  echo "==> Site health"
  local site_code api_code
  site_code="$(curl -s -o /dev/null -w "%{http_code}" "$SITE_URL/")"
  api_code="$(curl -s -o /dev/null -w "%{http_code}" "$SITE_URL/api/billing/")"
  echo "    $SITE_URL/              -> $site_code (expect 200)"
  echo "    $SITE_URL/api/billing/  -> $api_code (expect 401 — booted, auth-rejected)"
  [ "$site_code" = "200" ] || { echo "    FAIL: site did not return 200" >&2; failed=1; }
  [ "$api_code" = "401" ] || { echo "    FAIL: API did not return 401" >&2; failed=1; }

  echo "==> Entry bundle hash"
  local local_entry live_entry
  local_entry="$(grep -oE 'index-[A-Za-z0-9_-]+\.js' dist/index.html | head -1)"
  live_entry="$(curl -s "$SITE_URL/" | grep -oE 'index-[A-Za-z0-9_-]+\.js' | head -1)"
  if [ "$local_entry" = "$live_entry" ]; then
    echo "    OK: $live_entry"
  else
    echo "    MISMATCH: local=$local_entry live=$live_entry" >&2
    echo "    (if this is expected — the local build was never uploaded —" >&2
    echo "    run 'upload' first; this is not itself a script bug)" >&2
    failed=1
  fi

  echo "==> Content-type probe (every local .js must serve as JS, not nginx's"
  echo "    SPA-fallback text/html for a missing file — status codes alone miss"
  echo "    this; run in parallel, 20 at a time — 200+ files sequentially took"
  echo "    several minutes)"
  local total bad_output bad_count
  total=$(ls dist/assets/*.js | wc -l)
  bad_output="$(ls dist/assets/*.js | xargs -P 20 -I{} bash -c '_deploy_check_asset_content_type "$@"' _ {})"
  if [ -n "$bad_output" ]; then
    echo "$bad_output" | sed 's/^/    /'
    bad_count="$(echo "$bad_output" | wc -l)"
    echo "ERROR: $bad_count of $total JS files served wrong — likely missing on the server." >&2
    failed=1
  else
    echo "    OK — all $total JS files verified."
  fi

  if [ $failed -ne 0 ]; then
    echo "" >&2
    echo "verify-live FAILED — see the checks marked above." >&2
    exit 1
  fi
  echo ""
  echo "verify-live: all checks passed."
}

# ── full (non-destructive portion only) ─────────────────────────────────
cmd_full() {
  cmd_build
  cmd_backup
  cmd_upload
  cmd_verify_upload
  echo ""
  echo "==> Non-destructive stages done. Review 'prune-dry-run' yourself, then"
  echo "    run 'prune' and 'verify-live' as separate, deliberate steps."
}

usage() {
  sed -n '2,58p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

case "${1:-}" in
  build) cmd_build ;;
  backend-build) cmd_backend_build ;;
  backup) cmd_backup ;;
  upload) cmd_upload ;;
  verify-upload) cmd_verify_upload ;;
  prune-dry-run) cmd_prune_dry_run ;;
  prune) cmd_prune ;;
  backend-upload) cmd_backend_upload ;;
  verify-live) cmd_verify_live ;;
  full) cmd_full ;;
  *) usage; exit 1 ;;
esac
