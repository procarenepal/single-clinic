/**
 * Shared Print Layout Configuration Interface
 * This interface is used by both the print layout configuration page
 * and the PrintLayout component to ensure perfect synchronization.
 */
export interface PrintLayoutConfig {
  id?: string;
  clinicId: string;

  // Clinic Information
  clinicName: string;
  tagline?: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  phone: string;
  email: string;
  website?: string;

  // Logo and Branding
  logoUrl?: string;
  logoPosition: "left" | "center" | "right";
  logoSize: "small" | "medium" | "large";
  logoWidth: number;

  // Layout Settings
  headerHeight: "compact" | "standard" | "expanded";
  footerText?: string;
  pathologyFooterText?: string;
  pharmacyFooterText?: string;
  appointmentFooterText?: string;
  showFooter: boolean;
  showTagline?: boolean;
  showAddress?: boolean;
  showPhone?: boolean;
  showEmail?: boolean;
  showWebsite?: boolean;

  // Content spacing when printing without letterhead (for preprinted paper)
  contentTopMarginWithoutLetterheadMm?: number;

  // Default behavior for pathology reports
  defaultPathologyPrintWithoutLetterhead?: boolean;

  // Print Options (hidden from UI but used internally)
  paperSize: "A4" | "Letter" | "A5";
  thermalPaperWidthMm?: number;
  defaultPrintFormat?: string;
  margins: "narrow" | "normal" | "wide";
  fontSize: "small" | "medium" | "large";
  contentFontSize?: number;

  // Typography
  fontFamily?: string;

  // Colors (for colored prints)
  primaryColor?: string;
  secondaryColor?: string;
  titleColor?: string;
  textColor?: string;

  // Granular Positioning (px offsets from classic positions)
  logoPos?: { x: number; y: number };
  clinicNamePos?: { x: number; y: number };
  taglinePos?: { x: number; y: number };
  addressPos?: { x: number; y: number };
  phonePos?: { x: number; y: number };
  emailPos?: { x: number; y: number };
  websitePos?: { x: number; y: number };

  // Granular Field Styling (Individual Formatter overrides)
  boldFields?: string[];
  fieldColors?: Record<string, string>;
  fieldSizes?: Record<string, number>;
  fieldAlignments?: Record<string, "left" | "center" | "right">;

  // Metadata
  createdAt?: Date;
  updatedAt?: Date;
  updatedBy: string;
}

/**
 * Default Print Layout Configuration
 * Provides sensible defaults for new clinics
 */
export const DEFAULT_PRINT_LAYOUT: Omit<
  PrintLayoutConfig,
  "clinicId" | "updatedBy"
> = {
  clinicName: "",
  address: "",
  city: "",
  state: "",
  zipCode: "",
  country: "Nepal",
  phone: "",
  email: "",
  logoPosition: "left",
  logoSize: "medium",
  logoWidth: 80,
  headerHeight: "expanded",
  showFooter: true,
  footerText: "",
  pathologyFooterText: "",
  pharmacyFooterText: "",
  appointmentFooterText: "",
  showTagline: true,
  showAddress: true,
  showPhone: true,
  showEmail: true,
  showWebsite: true,
  paperSize: "A4",
  margins: "normal",
  fontSize: "medium",
  contentFontSize: 12,
  fontFamily: "'Inter', sans-serif",
  primaryColor: "#0ea5e9",
  secondaryColor: "#64748b",
  titleColor: "#1e293b",
  textColor: "#475569",
  contentTopMarginWithoutLetterheadMm: 20,
  defaultPathologyPrintWithoutLetterhead: false,
  thermalPaperWidthMm: 80,
  defaultPrintFormat: "A4",
  logoPos: { x: 0, y: 0 },
  clinicNamePos: { x: 0, y: 0 },
  taglinePos: { x: 0, y: 0 },
  addressPos: { x: 0, y: 0 },
  phonePos: { x: 0, y: 0 },
  emailPos: { x: 0, y: 0 },
  websitePos: { x: 0, y: 0 },
  boldFields: ["clinicName"],
  fieldColors: {},
  fieldSizes: {},
  fieldAlignments: {},
};

/**
 * Creates a new print layout configuration with defaults
 * @param clinicId - The clinic ID
 * @param userId - The user ID who is creating/updating the config
 * @param overrides - Any specific values to override
 * @returns Complete PrintLayoutConfig with defaults
 */
export function createPrintLayoutConfig(
  clinicId: string,
  userId: string,
  overrides: Partial<PrintLayoutConfig> = {},
): PrintLayoutConfig {
  return {
    ...DEFAULT_PRINT_LAYOUT,
    clinicId,
    updatedBy: userId,
    ...overrides,
  };
}

/**
 * Validates that a print layout configuration has all required fields
 * @param config - The configuration to validate
 * @returns True if valid, throws error if invalid
 */
export function validatePrintLayoutConfig(
  config: Partial<PrintLayoutConfig>,
): config is PrintLayoutConfig {
  const required: (keyof PrintLayoutConfig)[] = [
    "clinicId",
    "updatedBy",
    "clinicName",
  ];

  for (const field of required) {
    if (!config[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  return true;
}
