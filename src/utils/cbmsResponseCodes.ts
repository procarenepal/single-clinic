/**
 * Plain-English causes for the response codes CBMS (Nepal's IRD e-billing
 * API) returns, so a "Sync Failed" badge can say something more useful than
 * "Java Backend Sync Failed" — which is all it told staff before, even
 * though the backend had already captured the real code.
 *
 * Source: billing-backend's IrdCbmsService.java, the one place these codes
 * are interpreted server-side (cbmsResponseCode is set from exactly these
 * branches and returned on the invoice record, but nothing on the frontend
 * read it until now).
 */
const KNOWN_CODES: Record<string, string> = {
  "400": "IRD sync is not configured or enabled for this clinic. Check Settings → IRD/CBMS Configuration.",
  "100": "The clinic's IRD API credentials don't match what CBMS has on file. Check the username/password under Settings → IRD/CBMS Configuration.",
  "101": "CBMS says the bill this return refers to doesn't exist there.",
  "102": "CBMS had an internal error saving this bill. Usually transient — try again; contact IRD support if it keeps happening.",
  "103": "CBMS returned an unrecognized error. Check the configured API URL and this invoice's data.",
  "104": "CBMS rejected this invoice as invalid — likely a malformed field (date, amount, or tax split) on it.",
  "105": "CBMS says the original bill for this sales return doesn't exist there.",
};

/**
 * @param code The invoice's cbmsResponseCode — a CBMS application code
 *   (100-105), an HTTP status CBMS responded with, "2xx-NOCODE" (CBMS
 *   accepted the request but the response had no recognizable code), or
 *   "500" (a network/timeout/SSL exception reaching CBMS, not CBMS itself).
 * @returns A plain-English explanation, or null when the code is unknown or
 *   absent — callers should fall back to showing the raw code in that case.
 */
export function describeCbmsResponseCode(
  code: string | null | undefined,
): string | null {
  if (!code) return null;
  if (KNOWN_CODES[code]) return KNOWN_CODES[code];
  if (code === "2xx-NOCODE") {
    return "CBMS accepted the request but didn't return a recognizable status — this needs investigation.";
  }
  if (/^\d{3}$/.test(code) && code !== "500") {
    return `CBMS rejected the request (HTTP ${code}).`;
  }
  if (code === "500") {
    return "Could not reach the CBMS server — check connectivity, or this may be a temporary outage.";
  }

  return null;
}
