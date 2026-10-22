import { useRef, useCallback } from "react";

interface UsePaymentIdempotencyKeyReturn {
  /**
   * A stable identity for "this one payment attempt" — the same value on a
   * retry (the handler invoked again after an error) so recordPayment's
   * idempotencyKey option can tell a retry apart from a genuinely new
   * payment. Lazily generated on first call; stays the same until reset().
   */
  next: () => string;
  /** Call after the payment actually succeeds, so the NEXT independent payment gets its own key. */
  reset: () => void;
}

/**
 * See appointmentBillingService.recordPayment's idempotencyKey option: a
 * retried call whose key is already in paymentHistory is a safe no-op
 * instead of double-counting paidAmount and, for a wallet payment,
 * deducting the patient's balance a second time. This hook is the one
 * place every payment form generates that key, so a caller never has to
 * remember the reset-on-success rule itself.
 */
export const usePaymentIdempotencyKey = (): UsePaymentIdempotencyKeyReturn => {
  const ref = useRef<string | null>(null);

  const next = useCallback(() => {
    if (!ref.current) {
      ref.current = crypto.randomUUID();
    }

    return ref.current;
  }, []);

  const reset = useCallback(() => {
    ref.current = null;
  }, []);

  return { next, reset };
};
