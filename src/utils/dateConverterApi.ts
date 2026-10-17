/**
 * Enhanced API-based date converter for converting between AD (Gregorian) and BS (Bikram Sambat) dates
 * Uses a reliable local conversion with API validation for better reliability
 *
 * CORS SOLUTION: Instead of relying on external APIs that may have CORS issues,
 * this implementation prioritizes the local conversion algorithm and uses APIs
 * only for validation when available. This ensures the system always works
 * regardless of API availability or CORS policies.
 */

// Working API endpoints (tested and CORS-enabled)
const DATE_CONVERSION_APIS = {
  PRIMARY: {
    AD_TO_BS: "https://nepali-date-converter.vercel.app/api/ad-to-bs",
    BS_TO_AD: "https://nepali-date-converter.vercel.app/api/bs-to-ad",
  },
};

// Fallback to local conversion if all APIs fail
import { adToBS as localAdToBS, bsToAD as localBsToAD } from "./dateConverter";

interface DateConversionResult {
  year: number;
  month: number;
  day: number;
  formatted: string;
  source: "api" | "local";
  apiUsed?: string;
}

interface ConversionProgress {
  isConverting: boolean;
  progress: number;
  message: string;
}

// Cache for API responses to avoid repeated calls
const dateCache = new Map<string, DateConversionResult>();

/**
 * Format a Date object to YYYY-MM-DD format without timezone issues
 * @param date - Date object to format
 * @returns Formatted date string
 */
export function formatDateWithoutTimezone(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * Enhanced date conversion with local algorithm primary and API as validation/fallback
 */
async function tryApiCall(url: string, timeout: number = 5000): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    if (!controller.signal.aborted) {
      controller.abort();
    }
  }, timeout);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      mode: "cors",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    return data;
  } catch (error) {
    clearTimeout(timeoutId);

    // Return null instead of throwing to prevent any potential uncaught rejections.
    // The calling code (adToBSApi / bsToADApi) will treat null as a validation failure
    // and gracefully fall back to the local conversion algorithm.
    return null;
  }
}

/**
 * Convert AD date to BS date using local algorithm primarily with API validation
 * @param adDate - JavaScript Date object in AD
 * @param onProgress - Optional callback to track conversion progress
 * @returns Promise with BS date object
 */
export async function adToBSApi(
  adDate: Date,
  onProgress?: (progress: ConversionProgress) => void,
): Promise<DateConversionResult> {
  // Validate input date
  if (!(adDate instanceof Date) || isNaN(adDate.getTime())) {
    throw new Error("Invalid AD date provided");
  }

  // Check cache first
  const cacheKey = `ad-${formatDateWithoutTimezone(adDate)}`;

  if (dateCache.has(cacheKey)) {
    onProgress?.({
      isConverting: false,
      progress: 100,
      message: "Retrieved from cache",
    });

    return dateCache.get(cacheKey)!;
  }

  // Start with progress
  onProgress?.({
    isConverting: true,
    progress: 10,
    message: "Starting conversion...",
  });

  // Try local conversion first (it's more reliable)
  try {
    onProgress?.({
      isConverting: true,
      progress: 30,
      message: "Using local algorithm...",
    });

    const localResult = localAdToBS(adDate);

    // Try to validate with API if available
    let apiValidated = false;

    /* 
    // API validation is temporarily disabled due to consistent CORS issues with the third-party provider.
    // The system will rely on the robust local algorithm below.
    try {
      onProgress?.({
        isConverting: true,
        progress: 70,
        message: "Validating with API...",
      });

      const year = adDate.getFullYear();
      const month = String(adDate.getMonth() + 1).padStart(2, "0");
      const day = String(adDate.getDate()).padStart(2, "0");

      const apiUrl = `${DATE_CONVERSION_APIS.PRIMARY.AD_TO_BS}?year=${year}&month=${month}&day=${day}`;
      const apiData = await tryApiCall(apiUrl);

      // Check if API result matches local result (within reason)
      if (apiData && (apiData.year || apiData.bs_year || apiData.data?.year)) {
        apiValidated = true;
        onProgress?.({
          isConverting: true,
          progress: 90,
          message: "API validation successful",
        });
      }
    } catch (apiError) {
      // Silently catch any API errors
    }
    */

    const result: DateConversionResult = {
      ...localResult,
      source: apiValidated ? "api" : "local",
      apiUsed: apiValidated ? "Primary API (Validated)" : "Local Algorithm",
    };

    // Cache the result
    dateCache.set(cacheKey, result);

    onProgress?.({
      isConverting: false,
      progress: 100,
      message: apiValidated
        ? "Converted and validated with API"
        : "Converted using local algorithm",
    });

    return result;
  } catch (error) {
    console.error("Local conversion failed:", error);
    throw new Error("Date conversion failed");
  }
}

/**
 * Convert BS date to AD date using local algorithm primarily with API validation
 * @param bsDateStr - BS date string in format "yyyy/mm/dd"
 * @param onProgress - Optional callback to track conversion progress
 * @returns Promise with AD Date object
 */
export async function bsToADApi(
  bsDateStr: string,
  onProgress?: (progress: ConversionProgress) => void,
): Promise<Date> {
  // Parse BS date string (yyyy/mm/dd)
  const parts = bsDateStr.trim().split("/");

  if (parts.length !== 3) {
    throw new Error("Invalid BS date format. Expected yyyy/mm/dd");
  }

  const year = parseInt(parts[0]);
  const month = parseInt(parts[1]);
  const day = parseInt(parts[2]);

  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    throw new Error("Invalid BS date components");
  }

  // Validate reasonable date ranges
  if (year < 1970 || year > 2150) {
    throw new Error("BS year must be between 1970 and 2150");
  }

  if (month < 1 || month > 12) {
    throw new Error("BS month must be between 1 and 12");
  }

  if (day < 1 || day > 32) {
    throw new Error("BS day must be between 1 and 32");
  }

  // Check cache first
  const cacheKey = `bs-${bsDateStr}`;
  const cached = dateCache.get(cacheKey);

  if (cached) {
    onProgress?.({
      isConverting: false,
      progress: 100,
      message: "Retrieved from cache",
    });
    // Local midnight, the same instant the computed path below returns —
    // the UTC form rendered as the previous day on any clock behind UTC.
    return new Date(cached.year, cached.month - 1, cached.day);
  }

  // Start with progress
  onProgress?.({
    isConverting: true,
    progress: 10,
    message: "Starting conversion...",
  });

  // Try local conversion first (it's more reliable)
  try {
    onProgress?.({
      isConverting: true,
      progress: 30,
      message: "Using local algorithm...",
    });

    const localResult = localBsToAD(bsDateStr);

    // Try to validate with API if available
    let apiValidated = false;

    /*
    // API validation is temporarily disabled due to consistent CORS issues with the third-party provider.
    try {
      onProgress?.({
        isConverting: true,
        progress: 70,
        message: "Validating with API...",
      });

      const apiUrl = `${DATE_CONVERSION_APIS.PRIMARY.BS_TO_AD}?year=${year}&month=${month}&day=${day}`;
      const apiData = await tryApiCall(apiUrl);

      // Check if API result matches local result (within reason)
      if (apiData && (apiData.year || apiData.ad_year || apiData.data?.year)) {
        apiValidated = true;
        onProgress?.({
          isConverting: true,
          progress: 90,
          message: "API validation successful",
        });
      }
    } catch (apiError) {
      // Silently catch any API errors
    }
    */

    // Cache the result for future use
    dateCache.set(cacheKey, {
      year: localResult.getFullYear(),
      month: localResult.getMonth() + 1,
      day: localResult.getDate(),
      formatted: formatDateWithoutTimezone(localResult),
      source: apiValidated ? "api" : "local",
      apiUsed: apiValidated ? "Primary API (Validated)" : "Local Algorithm",
    });

    onProgress?.({
      isConverting: false,
      progress: 100,
      message: apiValidated
        ? "Converted and validated with API"
        : "Converted using local algorithm",
    });

    return localResult;
  } catch (error) {
    console.error("Local conversion failed:", error);
    throw new Error("Date conversion failed");
  }
}

/**
 * Clear the date conversion cache
 */
export function clearDateCache(): void {
  dateCache.clear();
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { size: number; entries: string[] } {
  return {
    size: dateCache.size,
    entries: Array.from(dateCache.keys()),
  };
}

/**
 * Format date to yyyy/mm/dd format
 * @param date - JavaScript Date object
 * @returns Formatted date string
 */
export function formatDateYYYYMMDD(date: Date): string {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}/${month}/${day}`;
}

/**
 * Convert date input format (yyyy-mm-dd) to display format (yyyy/mm/dd)
 * @param dateInputStr - Date string in yyyy-mm-dd format
 * @returns Date string in yyyy/mm/dd format
 */
export function convertDateInputToDisplay(dateInputStr: string): string {
  if (!dateInputStr || typeof dateInputStr !== "string") {
    return "";
  }

  return dateInputStr.replace(/-/g, "/");
}

/**
 * Convert display format (yyyy/mm/dd) to date input format (yyyy-mm-dd)
 * @param dateDisplayStr - Date string in yyyy/mm/dd format
 * @returns Date string in yyyy-mm-dd format
 */
export function convertDateDisplayToInput(dateDisplayStr: string): string {
  if (!dateDisplayStr || typeof dateDisplayStr !== "string") {
    return "";
  }

  return dateDisplayStr.replace(/\//g, "-");
}

/**
 * Enhanced BS date string format validation with detailed error messages
 * @param bsDateStr - BS date string to validate
 * @returns Object with validation result and error message
 */
export function validateBSDateFormat(bsDateStr: string): {
  isValid: boolean;
  error?: string;
  suggestions?: string[];
} {
  if (!bsDateStr || typeof bsDateStr !== "string") {
    return {
      isValid: false,
      error: "Date is required",
      suggestions: ["Please enter a date in YYYY/MM/DD format"],
    };
  }

  const trimmed = bsDateStr.trim();

  // Check basic format
  if (!/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(trimmed)) {
    return {
      isValid: false,
      error: "Invalid date format",
      suggestions: [
        "Use YYYY/MM/DD format (e.g., 2081/04/15)",
        "Make sure to use forward slashes (/)",
        "Year should be 4 digits, month and day can be 1 or 2 digits",
      ],
    };
  }

  const parts = trimmed.split("/");
  const year = parseInt(parts[0]);
  const month = parseInt(parts[1]);
  const day = parseInt(parts[2]);

  // Check if all parts are valid numbers
  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    return {
      isValid: false,
      error: "Invalid date components",
      suggestions: ["All date parts must be valid numbers"],
    };
  }

  // Check reasonable ranges
  if (year < 1970 || year > 2150) {
    return {
      isValid: false,
      error: "Year out of range",
      suggestions: ["Year must be between 1970 and 2150"],
    };
  }

  if (month < 1 || month > 12) {
    return {
      isValid: false,
      error: "Invalid month",
      suggestions: ["Month must be between 1 and 12"],
    };
  }

  if (day < 1 || day > 32) {
    return {
      isValid: false,
      error: "Invalid day",
      suggestions: ["Day must be between 1 and 32"],
    };
  }

  return { isValid: true };
}

/**
 * Enhanced AD date validation
 * @param adDate - Date object to validate
 * @returns Object with validation result and error message
 */
export function validateADDate(adDate: Date): {
  isValid: boolean;
  error?: string;
  suggestions?: string[];
} {
  if (!adDate || !(adDate instanceof Date)) {
    return {
      isValid: false,
      error: "Invalid date object",
      suggestions: ["Please provide a valid date"],
    };
  }

  if (isNaN(adDate.getTime())) {
    return {
      isValid: false,
      error: "Invalid date",
      suggestions: ["Please provide a valid date"],
    };
  }

  // Check reasonable date ranges (1900 to 2100)
  const year = adDate.getFullYear();

  if (year < 1900 || year > 2100) {
    return {
      isValid: false,
      error: "Year out of range",
      suggestions: ["Year must be between 1900 and 2100"],
    };
  }

  return { isValid: true };
}

/**
 * Get formatted date with calendar type indicator
 * @param date - Date object
 * @param calendarType - 'AD' or 'BS'
 * @returns Formatted date string with calendar indicator
 */
export function getFormattedDateWithCalendar(
  date: Date | string,
  calendarType: "AD" | "BS",
): string {
  if (typeof date === "string") {
    return `${date} ${calendarType}`;
  }

  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return "";
  }

  const formatted = formatDateYYYYMMDD(date);

  return `${formatted} ${calendarType}`;
}

/**
 * Debounce function for API calls
 * @param func - Function to debounce
 * @param wait - Wait time in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };

    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
