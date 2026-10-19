package com.procaresoft.billing.util;

import java.time.LocalDate;
import java.time.ZoneOffset;

/**
 * Converts a Gregorian (AD) date to its Bikram Sambat (BS, the Nepali
 * calendar) equivalent, formatted "YYYY.MM.DD" — the exact date format IRD's
 * CBMS API documentation uses in its own sample payloads (e.g.
 * invoice_date="2074.07.06"), as opposed to a Gregorian ISO date. Every
 * invoice this backend ever sent to CBMS sent a Gregorian date in that
 * field instead; CBMS was rejecting the payload outright ("104: model
 * invalid") on every single sync attempt as a result.
 *
 * The conversion table and day-counting algorithm below are a trimmed port
 * of BsCalendar.daysInMonth/toBik from medic/bikram-sambat
 * (https://github.com/medic/bikram-sambat, Java module at
 * java/lib/src/main/java/bikramsambat/), licensed Apache License 2.0 — safe
 * for use in this proprietary codebase (unlike this project's own frontend
 * nepali-datetime dependency, which is GPLv3 and was deliberately NOT ported
 * from for that reason). ENCODED_MONTH_LENGTHS and the epoch constants are
 * copied verbatim; everything else here is reworked to take/return
 * java.time types instead of parsing date strings, and the unused
 * Gregorian-reverse and Devanagari-rendering parts of the original are not
 * carried over, since this backend only ever needs AD -> BS.
 *
 * Verified before use (not merely trusted) by compiling the original,
 * unmodified upstream source locally and cross-checking its output against
 * this app's own frontend nepali-datetime package (run directly, not read
 * off a screenshot) for several dates, including Nepali New Year for three
 * different years and the date this class was written on — all matched,
 * and BS -> AD -> BS round-tripped stable. See
 * BikramSambatDateTest for the same cases as an executable regression
 * guard.
 */
public final class BikramSambatDate {

    private BikramSambatDate() {}

    // "We have defined our own Epoch for Bikram Sambat: 1970-1-1 BS or
    // 1913-4-13 AD" — verbatim from the upstream source. The day-counting
    // loop below walks forward from this epoch one BS year at a time.
    private static final long BS_EPOCH_TS = -1789990200000L; // 1913-4-13 AD, ms since Unix epoch, GMT
    private static final int BS_YEAR_ZERO = 1970;
    private static final long MS_PER_DAY = 86_400_000L;

    // Verbatim from upstream BsCalendar.ENCODED_MONTH_LENGTHS. Each BS year
    // (starting at BS_YEAR_ZERO) is packed into one long: 2 bits per month,
    // the value 0-3 added to a base of 29 gives that month's day count
    // (29-32 days, matching how BS months actually vary). Do not hand-edit —
    // regenerate from upstream's own scripts/encode-days-in-month.js if this
    // ever needs extending past whatever year range it currently covers.
    private static final long[] ENCODED_MONTH_LENGTHS = {
            5315258L,5314490L,9459438L,8673005L,5315258L,5315066L,9459438L,8673005L,5315258L,5314298L,9459438L,5327594L,5315258L,5314298L,9459438L,5327594L,5315258L,5314286L,9459438L,5315306L,5315258L,5314286L,8673006L,5315306L,5315258L,5265134L,8673006L,5315258L,5315258L,9459438L,8673005L,5315258L,5314298L,9459438L,8673005L,5315258L,5314298L,9459438L,8473322L,5315258L,5314298L,9459438L,5327594L,5315258L,5314298L,9459438L,5327594L,5315258L,5314286L,8673006L,5315306L,5315258L,5265134L,8673006L,5315306L,5315258L,9459438L,8673005L,5315258L,5314490L,9459438L,8673005L,5315258L,5314298L,9459438L,8473325L,5315258L,5314298L,9459438L,5327594L,5315258L,5314298L,9459438L,5327594L,5315258L,5314286L,9459438L,5315306L,5315258L,5265134L,8673006L,5315306L,5315258L,5265134L,8673006L,5315258L,5314490L,9459438L,8673005L,5315258L,5314298L,9459438L,8669933L,5315258L,5314298L,9459438L,8473322L,5315258L,5314298L,9459438L,5327594L,5315258L,5314286L,9459438L,5315306L,5315258L,5265134L,8673006L,5315306L,5315258L,5265134L,8673006L,5315258L,5315258L,5527226L,5528046L,5527277L,5528250L,5528057L,5527277L,5527277L
    };

    private static int daysInMonth(int year, int month) {
        if (month < 1 || month > 12) {
            throw new IllegalArgumentException("Month does not exist: " + month);
        }
        int idx = year - BS_YEAR_ZERO;
        if (idx < 0 || idx >= ENCODED_MONTH_LENGTHS.length) {
            throw new IllegalArgumentException("BS year outside supported range: " + year);
        }
        return 29 + (int) ((ENCODED_MONTH_LENGTHS[idx] >>> ((month - 1) << 1)) & 3);
    }

    /** @return the BS equivalent of {@code ad}, formatted "YYYY.MM.DD" per IRD's documented invoice_date/credit_note_date format. */
    public static String toBsDateString(LocalDate ad) {
        long adMillis = ad.atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli();
        int daysSinceEpoch = (int) Math.floor((adMillis - BS_EPOCH_TS) / (double) MS_PER_DAY) + 1;

        if (daysSinceEpoch <= 0) {
            throw new IllegalArgumentException("Date outside supported range: " + ad + " (before BS epoch)");
        }

        int year = BS_YEAR_ZERO;
        int remaining = daysSinceEpoch;

        while (remaining > 0) {
            for (int month = 1; month <= 12; month++) {
                int dim = daysInMonth(year, month);
                if (remaining <= dim) {
                    return year + "." + zPad(month) + "." + zPad(remaining);
                }
                remaining -= dim;
            }
            year++;
        }
        throw new IllegalArgumentException("Date outside supported range: " + ad);
    }

    private static String zPad(int x) {
        return x > 9 ? Integer.toString(x) : "0" + x;
    }
}
