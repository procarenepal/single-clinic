import { tv } from "tailwind-variants";

// ── Page title ────────────────────────────────────────────────────────────────
export const title = tv({
  base: "tracking-tight inline font-bold leading-tight",
  variants: {
    color: {
      primary: "!text-primary",
      secondary: "text-health-700",
      warning: "text-saffron-600",
      success: "text-health-600",
      danger: "text-red-600",
      foreground: "text-foreground",
      // Legacy compat
      blue: "text-nepal-600",
      green: "text-health-600",
      yellow: "text-saffron-600",
    },
    size: {
      xs: "text-label", // 12px
      sm: "text-[13px]",
      md: "text-section-title", // 14px
      lg: "text-page-title", // 15px
      xl: "text-stat", // 20px
    },
    fullWidth: {
      true: "w-full block",
    },
  },
  defaultVariants: {
    size: "md",
    color: "foreground",
  },
});

// ── Subtitle ──────────────────────────────────────────────────────────────────
export const subtitle = tv({
  base: "w-full my-1 text-sm text-mountain-500 block max-w-full leading-snug",
  variants: {
    fullWidth: {
      true: "!w-full",
    },
    size: {
      sm: "text-xs",
      md: "text-sm",
      lg: "text-base",
    },
  },
  defaultVariants: {
    fullWidth: true,
    size: "md",
  },
});

// ── Section heading (inside a card/panel) ─────────────────────────────────────
export const sectionTitle = tv({
  base: "font-semibold text-mountain-800 mb-2",
  variants: {
    size: {
      xs: "text-xs uppercase tracking-wider text-mountain-500", // label style
      sm: "text-sm",
      md: "text-base",
      lg: "text-lg",
    },
    uppercase: {
      true: "uppercase tracking-wider text-xs text-mountain-400 font-semibold",
    },
  },
  defaultVariants: {
    size: "sm",
  },
});

// ── Badge / status pill ───────────────────────────────────────────────────────
// Usage: className={badge({ variant: 'primary' })}
export const badge = tv({
  base: "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium",
  variants: {
    variant: {
      primary: "bg-teal-100 text-teal-800",
      secondary: "bg-health-100 text-health-800",
      warning: "bg-saffron-100 text-saffron-800",
      danger: "bg-red-100 text-red-700",
      success: "bg-health-100 text-health-800",
      neutral: "bg-mountain-100 text-mountain-700",
      // Flat/bordered variant
      outline: "border border-current bg-transparent",
    },
  },
  defaultVariants: {
    variant: "primary",
  },
});

// ── Compact stat value (for KPI cards) ────────────────────────────────────────
export const statValue = tv({
  base: "font-bold tracking-tighter text-foreground leading-none",
  variants: {
    size: {
      sm: "text-stat-sm", // 15px
      md: "text-stat", // 20px
      lg: "text-[24px]",
    },
  },
  defaultVariants: {
    size: "md",
  },
});

// ── Compact label (always uppercase, muted, tight) ────────────────────────────
export const label = tv({
  base: "text-xs font-semibold uppercase tracking-wider text-foreground-400",
});
