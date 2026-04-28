/**
 * Application configuration for the standalone single-clinic system.
 */
export const APP_CONFIG = {
    IS_STANDALONE: true,
    // If we decide to keep using a clinicId for DB queries, we can set a fallback here.
    // In a truly flattened model, we might stop using clinicId entirely in queries.
    DEFAULT_CLINIC_ID: "standalone-clinic",
    BRAND_NAME: "ProCare Software",
    PRIMARY_COLOR: "#006FEE", // ProCare Blue
};
