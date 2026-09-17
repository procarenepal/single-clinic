#!/usr/bin/env bash
#
# Live demonstration script for IRD's CBMS API — for use during an IRD
# software-enlistment verification, when an officer asks to see the
# integration tested against the real API, not just described.
#
# By default this uses IRD's own PUBLISHED developer test credentials from
# ird_api_documentation.pdf (Test_CBMS / seller_pan 999999999) — not this
# clinic's live taxpayer credentials — so it's safe to run repeatedly
# without touching any real filing. To demonstrate against this clinic's
# actual account instead, pass real credentials via the environment
# variables documented below.
#
# What it does, in order, printing a clear PASS/FAIL line for each step:
#   1. Posts a sales invoice to POST /api/bill with a fresh, unique invoice
#      number — expects response code 200 (success).
#   2. Re-submits the SAME invoice number — expects response code 101
#      ("bill already exists"), demonstrating duplicate-submission handling.
#   3. Posts a credit note (sales return) against the invoice from step 1 to
#      POST /api/billreturn — expects response code 200 (success).
#
# Usage (from billing-backend/):
#   scripts/test-cbms-live.sh
#
# To test against a real clinic account instead of IRD's shared test login:
#   CBMS_USERNAME='...' CBMS_PASSWORD='...' CBMS_SELLER_PAN='...' \
#   CBMS_BUYER_PAN='...' scripts/test-cbms-live.sh
#
# Requires: curl (already used elsewhere in this repo's scripts).

set -uo pipefail

CBMS_BASE_URL="${CBMS_BASE_URL:-https://cbapi.ird.gov.np}"
CBMS_USERNAME="${CBMS_USERNAME:-Test_CBMS}"
CBMS_PASSWORD="${CBMS_PASSWORD:-test@321}"
CBMS_SELLER_PAN="${CBMS_SELLER_PAN:-999999999}"
CBMS_BUYER_PAN="${CBMS_BUYER_PAN:-123456789}"
CBMS_FISCAL_YEAR="${CBMS_FISCAL_YEAR:-2073.074}"

INVOICE_NUMBER="TEST-$(date +%s)"
TODAY_AD="$(date +%Y-%m-%d)T$(date +%H:%M:%S)"
# CBMS expects Nepali-style dates on invoice_date/credit_note_date in its own
# sample data (e.g. 2074.07.06) — using the same placeholder format IRD's
# own sample code uses, since this script demonstrates API behavior, not a
# real filing (that part is generated correctly by the actual application).
SAMPLE_NEPALI_DATE="2074.07.06"

PASS=0
FAIL=0

echo "=================================================================="
echo " CBMS Live API Test — $(date)"
echo " Endpoint base: $CBMS_BASE_URL"
echo " Username:      $CBMS_USERNAME"
echo " Seller PAN:    $CBMS_SELLER_PAN"
echo " Invoice #:     $INVOICE_NUMBER"
echo "=================================================================="
echo ""

post_bill() {
  local invoice_num="$1"
  curl -s --max-time 20 -X POST "$CBMS_BASE_URL/api/bill" \
    -H "Content-Type: application/json" -H "Accept: application/json" \
    -d "{\"username\":\"$CBMS_USERNAME\",\"password\":\"$CBMS_PASSWORD\",\"seller_pan\":\"$CBMS_SELLER_PAN\",\"buyer_pan\":\"$CBMS_BUYER_PAN\",\"buyer_name\":\"\",\"fiscal_year\":\"$CBMS_FISCAL_YEAR\",\"invoice_number\":\"$invoice_num\",\"invoice_date\":\"$SAMPLE_NEPALI_DATE\",\"total_sales\":1130,\"taxable_sales_vat\":1000,\"vat\":130,\"excisable_amount\":0,\"excise\":0,\"taxable_sales_hst\":0,\"hst\":0,\"amount_for_esf\":0,\"esf\":0,\"export_sales\":0,\"tax_exempted_sales\":0,\"isrealtime\":true,\"datetimeClient\":\"$TODAY_AD\"}"
}

post_credit_note() {
  local ref_invoice_num="$1"
  curl -s --max-time 20 -X POST "$CBMS_BASE_URL/api/billreturn" \
    -H "Content-Type: application/json" -H "Accept: application/json" \
    -d "{\"username\":\"$CBMS_USERNAME\",\"password\":\"$CBMS_PASSWORD\",\"seller_pan\":\"$CBMS_SELLER_PAN\",\"buyer_pan\":\"$CBMS_BUYER_PAN\",\"buyer_name\":\"\",\"fiscal_year\":\"$CBMS_FISCAL_YEAR\",\"ref_invoice_number\":\"$ref_invoice_num\",\"credit_note_number\":\"CN-$ref_invoice_num\",\"credit_note_date\":\"$SAMPLE_NEPALI_DATE\",\"reason_for_return\":\"Live verification test\",\"total_sales\":1130,\"taxable_sales_vat\":1000,\"vat\":130,\"excisable_amount\":0,\"excise\":0,\"taxable_sales_hst\":0,\"hst\":0,\"amount_for_esf\":0,\"esf\":0,\"export_sales\":0,\"tax_exempted_sales\":0,\"isrealtime\":true,\"datetimeClient\":\"$TODAY_AD\"}"
}

check() {
  local label="$1" expected="$2" actual="$3"
  if [[ "$actual" == "$expected" ]]; then
    echo "  PASS — $label (response code: $actual)"
    PASS=$((PASS + 1))
  else
    echo "  FAIL — $label (expected $expected, got: $actual)"
    FAIL=$((FAIL + 1))
  fi
}

echo "1/3  Posting a new sales invoice ($INVOICE_NUMBER)..."
RESP1=$(post_bill "$INVOICE_NUMBER")
echo "     Raw response: $RESP1"
check "New invoice accepted" "200" "$RESP1"
echo ""

echo "2/3  Re-submitting the SAME invoice number (expect duplicate rejection)..."
RESP2=$(post_bill "$INVOICE_NUMBER")
echo "     Raw response: $RESP2"
check "Duplicate correctly rejected" "101" "$RESP2"
echo ""

echo "3/3  Posting a credit note (sales return) against $INVOICE_NUMBER..."
RESP3=$(post_credit_note "$INVOICE_NUMBER")
echo "     Raw response: $RESP3"
check "Credit note accepted" "200" "$RESP3"
echo ""

echo "=================================================================="
echo " Results: $PASS passed, $FAIL failed"
echo "=================================================================="

if [[ $FAIL -gt 0 ]]; then
  echo ""
  echo "Note: a FAIL here can also mean a transient network hiccup on IRD's"
  echo "side (occasionally seen as a connection reset rather than an error"
  echo "code) — re-run the script once before treating a failure as real."
  exit 1
fi

exit 0
