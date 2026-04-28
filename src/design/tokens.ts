// ══════════════════════════════════════════════════════════════════════════════
// Clinic Clarity — Design Tokens v2
// Flat design language for Procare Software SaaS
// Key principles: no shadows, compact spacing, border-based depth
// ══════════════════════════════════════════════════════════════════════════════

export const colors = {
  // ── Primary: Clinical Teal ──────────────────────────────────────────────
  primary: {
    DEFAULT: "#0356a1", // ProCare Blue (previously teal-700)
    hover: "#026dc7", // ProCare Blue (previously teal-600)
    light: "#e0effe", // ProCare Blue (previously teal-100)
    foreground: "#ffffff",
    soft: "bg-teal-100 text-teal-700", // (Uses re-mapped teal classes)
  },
  // ── Secondary: Health Green ─────────────────────────────────────────────
  secondary: {
    DEFAULT: "#16a34a",
    foreground: "#ffffff",
    soft: "bg-health-100 text-health-700",
  },
  // ── Semantic ────────────────────────────────────────────────────────────
  danger: {
    DEFAULT: "#e11d48", // rose-600
    foreground: "#ffffff",
    soft: "bg-rose-100 text-rose-700",
  },
  warning: {
    DEFAULT: "#d97706", // amber-600
    foreground: "#ffffff",
    soft: "bg-amber-100 text-amber-700",
  },
  success: {
    DEFAULT: "#16a34a",
    foreground: "#ffffff",
    soft: "bg-green-100 text-green-700",
  },
  // ── Neutrals ─────────────────────────────────────────────────────────
  muted: {
    foreground: "#64748b", // slate-500
  },
  // ── Surfaces ─────────────────────────────────────────────────────────
  background: {
    DEFAULT: "#f8fafc", // slate-50
    elevated: "#ffffff",
  },
  // ── Borders (no shadow — depth via 1px borders) ───────────────────────
  border: {
    subtle: "#e2e8f0", // slate-200
    strong: "#cbd5e1", // slate-300
    focus: "#0356a1", // ProCare Blue
  },
  focus: {
    ring: "#0356a1",
  },
};

// ── Compact Border Radius ────────────────────────────────────────────────────
// Philosophy: flat corners. No pill shapes for structural elements.
export const radii = {
  none: "0",
  xs: "0.125rem", // 2px
  sm: "0.375rem", // 6px — inputs, badges, chips
  DEFAULT: "0.5rem", // 8px — buttons, cards (default)
  md: "0.5rem", // 8px — modals, panels
  lg: "0.625rem", // 10px — large panels
  xl: "0.75rem", // 12px
  full: "9999px", // pills (use sparingly)
};

// ── Compact Spacing (density-focused) ────────────────────────────────────────
export const spacing = {
  px: "1px",
  "0": "0",
  "1": "0.25rem", // 4px
  "1.5": "0.375rem", // 6px
  "2": "0.5rem", // 8px  — default tight gap
  "2.5": "0.625rem", // 10px
  "3": "0.75rem", // 12px — card padding (compact)
  "4": "1rem", // 16px — section gap
  "5": "1.25rem", // 20px
  "6": "1.5rem", // 24px
  "8": "2rem", // 32px
  "10": "2.5rem", // 40px
  "12": "3rem", // 48px
};

// ── No Shadows ────────────────────────────────────────────────────────────────
// All depth is expressed through 1px borders and tinted backgrounds.
// Import and use `borders` from this file instead.
export const shadows = {
  none: "none",
  // Focus rings only — not structural depth
  ring: {
    teal: "0 0 0 3px rgba(3, 86, 161, 0.2)",
    rose: "0 0 0 3px rgba(225, 29, 72, 0.2)",
    violet: "0 0 0 3px rgba(124, 58, 237, 0.2)",
    blue: "0 0 0 3px rgba(2, 132, 199, 0.2)",
  },
};

// ── Typography ────────────────────────────────────────────────────────────────
export const typography = {
  fontFamily: {
    sans: "'Nunito', 'Plus Jakarta Sans', Inter, system-ui, sans-serif",
    mono: "'JetBrains Mono', 'Fira Code', monospace",
    nepali: "'Noto Sans Devanagari', sans-serif",
  },
  // Compact type scale — base is 13px
  sizes: {
    "2xs": "0.8125rem", // 13px
    xs: "0.875rem", // 14px — captions, labels
    sm: "0.9375rem", // 15px — secondary text
    base: "1rem", // 16px — body (default)
    md: "1.25rem", // 20px
    lg: "1.375rem", // 22px — section titles
    xl: "1.75rem", // 28px
    "2xl": "2.25rem", // 36px — page titles
    "3xl": "2.625rem", // 42px — hero numbers
  },
  weights: {
    normal: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
    extrabold: "800",
  },
  tracking: {
    tighter: "-0.03em",
    tight: "-0.02em",
    normal: "-0.01em",
    wide: "0.02em",
    wider: "0.06em", // used for uppercase labels
    widest: "0.1em",
  },
};

// ── Layout ────────────────────────────────────────────────────────────────────
export const layout = {
  sidebarWidth: "220px", // compact sidebar
  headerHeight: "48px", // compact header (vs typical 64px)
  contentPadding: "1rem",
  pageMaxWidth: "1280px",

  // Grid column patterns for compact dashboards
  grids: {
    stats: "repeat(auto-fit, minmax(160px, 1fr))",
    cards: "repeat(auto-fit, minmax(280px, 1fr))",
    form: "1fr 1fr",
    formWide: "1fr 1fr 1fr",
  },
};

// ── Transitions ─────────────────────────────────────────────────────────────
// Snappy — flat UIs should feel crisp, not floaty
export const transitions = {
  instant: "80ms ease-out",
  fast: "120ms ease-out",
  normal: "180ms ease-out",
  slow: "300ms ease-out",
};

// ── Theme Palette Map ─────────────────────────────────────────────────────────
export type ThemeKey =
  | "clarity"
  | "clarity-dark"
  | "rose-clinic"
  | "violet-clinical"
  | "carbon-dark"
  | "arctic";

export const themesPalette: Record<
  ThemeKey,
  {
    label: string;
    description: string;
    primary: string;
    bg: string;
    border: string;
    previewBg: string;
    previewPrimary: string;
  }
> = {
  clarity: {
    label: "Clarity",
    description: "Teal-primary, flat, professional",
    primary: "#0f766e",
    bg: "#f8fafc",
    border: "#e2e8f0",
    previewBg: "bg-slate-100",
    previewPrimary: "bg-teal-700",
  },
  "clarity-dark": {
    label: "Clarity Dark",
    description: "Dark surface, teal accent",
    primary: "#2dd4bf",
    bg: "#09090b",
    border: "#3f3f46",
    previewBg: "bg-zinc-900",
    previewPrimary: "bg-teal-400",
  },
  "rose-clinic": {
    label: "Rose Clinic",
    description: "Warm rose, feminine healthcare",
    primary: "#e11d48",
    bg: "#fff1f2",
    border: "#fda4af",
    previewBg: "bg-rose-100",
    previewPrimary: "bg-rose-600",
  },
  "violet-clinical": {
    label: "Violet Clinical",
    description: "Deep violet, analytical premium",
    primary: "#7c3aed",
    bg: "#f5f3ff",
    border: "#c4b5fd",
    previewBg: "bg-violet-100",
    previewPrimary: "bg-violet-600",
  },
  "carbon-dark": {
    label: "Carbon Dark",
    description: "Near-black, ultra-focused night mode",
    primary: "#0d9488",
    bg: "#09090b",
    border: "#27272a",
    previewBg: "bg-zinc-950",
    previewPrimary: "bg-teal-600",
  },
  arctic: {
    label: "Arctic",
    description: "Sky blue, crisp minimal",
    primary: "#0284c7",
    bg: "#f8fafc",
    border: "#e0f2fe",
    previewBg: "bg-slate-50",
    previewPrimary: "bg-sky-600",
  },
};
