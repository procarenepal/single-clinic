const PAYMENT_METHOD_KEY = "procare:lastPaymentMethod";

/**
 * Remembers the last payment method a staff member actually used, so every
 * new "Record Payment" form across appointment/pathology/pharmacy defaults
 * to it instead of always resetting to "cash".
 */
export const getLastPaymentMethod = (fallback: string): string => {
  try {
    return localStorage.getItem(PAYMENT_METHOD_KEY) || fallback;
  } catch {
    return fallback;
  }
};

export const setLastPaymentMethod = (method: string): void => {
  try {
    localStorage.setItem(PAYMENT_METHOD_KEY, method);
  } catch {
    // private browsing / disabled storage — remembering is a nice-to-have,
    // never let it block the actual payment
  }
};
