@echo off
setlocal enabledelayedexpansion

rem Live demonstration script for IRD's CBMS API (Windows cmd version).
rem Same test as test-cbms-live.sh, for use on a machine without Git Bash.
rem
rem Uses IRD's own PUBLISHED developer test credentials from
rem ird_api_documentation.pdf (Test_CBMS / seller_pan 999999999) by default -
rem safe to run repeatedly, does not touch this clinic's real filing.
rem
rem To test against this clinic's real taxpayer credentials instead, set
rem these before running (or edit them below):
rem   set CBMS_USERNAME=...
rem   set CBMS_PASSWORD=...
rem   set CBMS_SELLER_PAN=...
rem   set CBMS_BUYER_PAN=...
rem
rem Requires: curl (built into Windows 10/11 - no separate install needed).

if not defined CBMS_BASE_URL set CBMS_BASE_URL=https://cbapi.ird.gov.np
if not defined CBMS_USERNAME set CBMS_USERNAME=Test_CBMS
if not defined CBMS_PASSWORD set CBMS_PASSWORD=test@321
if not defined CBMS_SELLER_PAN set CBMS_SELLER_PAN=999999999
if not defined CBMS_BUYER_PAN set CBMS_BUYER_PAN=123456789
if not defined CBMS_FISCAL_YEAR set CBMS_FISCAL_YEAR=2073.074

rem Build a unique invoice number from the current time (HHMMSS + random).
set INVOICE_NUMBER=TEST-%time:~0,2%%time:~3,2%%time:~6,2%%random%
set INVOICE_NUMBER=%INVOICE_NUMBER: =0%
set SAMPLE_NEPALI_DATE=2074.07.06

set PASSCOUNT=0
set FAILCOUNT=0

echo ==================================================================
echo  CBMS Live API Test - %date% %time%
echo  Endpoint base: %CBMS_BASE_URL%
echo  Username:      %CBMS_USERNAME%
echo  Seller PAN:    %CBMS_SELLER_PAN%
echo  Invoice #:     %INVOICE_NUMBER%
echo ==================================================================
echo.

echo 1/3  Posting a new sales invoice (%INVOICE_NUMBER%)...
for /f "delims=" %%R in ('curl -s --max-time 20 -X POST "%CBMS_BASE_URL%/api/bill" -H "Content-Type: application/json" -H "Accept: application/json" -d "{\"username\":\"%CBMS_USERNAME%\",\"password\":\"%CBMS_PASSWORD%\",\"seller_pan\":\"%CBMS_SELLER_PAN%\",\"buyer_pan\":\"%CBMS_BUYER_PAN%\",\"buyer_name\":\"\",\"fiscal_year\":\"%CBMS_FISCAL_YEAR%\",\"invoice_number\":\"%INVOICE_NUMBER%\",\"invoice_date\":\"%SAMPLE_NEPALI_DATE%\",\"total_sales\":1130,\"taxable_sales_vat\":1000,\"vat\":130,\"excisable_amount\":0,\"excise\":0,\"taxable_sales_hst\":0,\"hst\":0,\"amount_for_esf\":0,\"esf\":0,\"export_sales\":0,\"tax_exempted_sales\":0,\"isrealtime\":true,\"datetimeClient\":\"2026-08-31T12:00:00\"}"') do set RESP1=%%R
echo      Raw response: !RESP1!
if "!RESP1!"=="200" (
  echo   PASS - New invoice accepted
  set /a PASSCOUNT+=1
) else (
  echo   FAIL - New invoice ^(expected 200, got !RESP1!^)
  set /a FAILCOUNT+=1
)
echo.

echo 2/3  Re-submitting the SAME invoice number ^(expect duplicate rejection^)...
for /f "delims=" %%R in ('curl -s --max-time 20 -X POST "%CBMS_BASE_URL%/api/bill" -H "Content-Type: application/json" -H "Accept: application/json" -d "{\"username\":\"%CBMS_USERNAME%\",\"password\":\"%CBMS_PASSWORD%\",\"seller_pan\":\"%CBMS_SELLER_PAN%\",\"buyer_pan\":\"%CBMS_BUYER_PAN%\",\"buyer_name\":\"\",\"fiscal_year\":\"%CBMS_FISCAL_YEAR%\",\"invoice_number\":\"%INVOICE_NUMBER%\",\"invoice_date\":\"%SAMPLE_NEPALI_DATE%\",\"total_sales\":1130,\"taxable_sales_vat\":1000,\"vat\":130,\"excisable_amount\":0,\"excise\":0,\"taxable_sales_hst\":0,\"hst\":0,\"amount_for_esf\":0,\"esf\":0,\"export_sales\":0,\"tax_exempted_sales\":0,\"isrealtime\":true,\"datetimeClient\":\"2026-08-31T12:00:00\"}"') do set RESP2=%%R
echo      Raw response: !RESP2!
if "!RESP2!"=="101" (
  echo   PASS - Duplicate correctly rejected
  set /a PASSCOUNT+=1
) else (
  echo   FAIL - Duplicate rejection ^(expected 101, got !RESP2!^)
  set /a FAILCOUNT+=1
)
echo.

echo 3/3  Posting a credit note ^(sales return^) against %INVOICE_NUMBER%...
for /f "delims=" %%R in ('curl -s --max-time 20 -X POST "%CBMS_BASE_URL%/api/billreturn" -H "Content-Type: application/json" -H "Accept: application/json" -d "{\"username\":\"%CBMS_USERNAME%\",\"password\":\"%CBMS_PASSWORD%\",\"seller_pan\":\"%CBMS_SELLER_PAN%\",\"buyer_pan\":\"%CBMS_BUYER_PAN%\",\"buyer_name\":\"\",\"fiscal_year\":\"%CBMS_FISCAL_YEAR%\",\"ref_invoice_number\":\"%INVOICE_NUMBER%\",\"credit_note_number\":\"CN-%INVOICE_NUMBER%\",\"credit_note_date\":\"%SAMPLE_NEPALI_DATE%\",\"reason_for_return\":\"Live verification test\",\"total_sales\":1130,\"taxable_sales_vat\":1000,\"vat\":130,\"excisable_amount\":0,\"excise\":0,\"taxable_sales_hst\":0,\"hst\":0,\"amount_for_esf\":0,\"esf\":0,\"export_sales\":0,\"tax_exempted_sales\":0,\"isrealtime\":true,\"datetimeClient\":\"2026-08-31T12:05:00\"}"') do set RESP3=%%R
echo      Raw response: !RESP3!
if "!RESP3!"=="200" (
  echo   PASS - Credit note accepted
  set /a PASSCOUNT+=1
) else (
  echo   FAIL - Credit note ^(expected 200, got !RESP3!^)
  set /a FAILCOUNT+=1
)
echo.

echo ==================================================================
echo  Results: !PASSCOUNT! passed, !FAILCOUNT! failed
echo ==================================================================

if !FAILCOUNT! GTR 0 (
  echo.
  echo Note: a FAIL here can also mean a transient network hiccup on IRD's
  echo side ^(sometimes seen as an empty response rather than an error
  echo code^) - re-run the script once before treating a failure as real.
  exit /b 1
)

exit /b 0
