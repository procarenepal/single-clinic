/**
 * Scrollbar Theme Utility
 * Dynamically updates CSS custom properties for scrollbar colors
 * based on the currently active theme class.
 */

export interface ScrollbarThemeConfig {
  thumb: string;
  track: string;
  border: string;
  hover: string;
}

export const scrollbarThemes: Record<string, ScrollbarThemeConfig> = {
  // ── Clinic Clarity (new themes) ───────────────────────────────────────────
  "theme-light": {
    thumb: "109 40 217", // violet-700
    track: "245 243 255", // violet-50
    border: "237 233 254", // violet-100
    hover: "124 58 237", // violet-600
  },
  "theme-dark": {
    thumb: "139 92 246", // violet-500
    track: "9 9 11", // zinc-950
    border: "24 24 27", // zinc-900
    hover: "167 139 250", // violet-400
  },
  "theme-rose-clinic": {
    thumb: "225 29 72", // rose-600
    track: "255 241 242", // rose-50
    border: "255 228 230", // rose-100
    hover: "190 18 60", // rose-700
  },
  "theme-violet-clinical": {
    thumb: "124 58 237", // violet-600
    track: "245 243 255", // violet-50
    border: "237 233 254", // violet-100
    hover: "109 40 217", // violet-700
  },
  "theme-carbon-dark": {
    thumb: "124 58 237", // violet-600
    track: "9 9 11", // zinc-950
    border: "17 17 20", // near-black
    hover: "139 92 246", // violet-500
  },
  "theme-arctic": {
    thumb: "124 58 237", // violet-600
    track: "240 249 255", // violet-50
    border: "237 233 254", // violet-100
    hover: "109 40 217", // violet-700
  },

  // ── Legacy themes (backward compat) ────────────────────────────────────────
  "theme-medical": {
    thumb: "37 99 235", // blue-600
    track: "248 250 252", // slate-50
    border: "241 245 249", // slate-100
    hover: "29 78 216", // blue-700
  },
  "theme-nature": {
    thumb: "22 163 74", // green-600
    track: "240 253 244", // green-50
    border: "220 252 231", // green-100
    hover: "21 128 61", // green-700
  },
  "theme-ocean": {
    thumb: "8 145 178", // cyan-600
    track: "236 254 255", // cyan-50
    border: "207 250 254", // cyan-100
    hover: "14 116 144", // cyan-700
  },
  "theme-sunset": {
    thumb: "234 88 12", // orange-600
    track: "255 237 213", // orange-100
    border: "254 215 170", // orange-200
    hover: "194 65 12", // orange-700
  },
};

/**
 * Updates scrollbar CSS custom properties to match the given theme.
 * Silently falls back to the light theme config if the theme is unknown.
 * @param theme - Theme class name e.g. 'theme-light', 'theme-rose-clinic'
 */
export function updateScrollbarTheme(theme: string): void {
  const root = document.documentElement;
  const config = scrollbarThemes[theme] ?? scrollbarThemes["theme-light"];

  root.style.setProperty("--scrollbar-thumb", config.thumb);
  root.style.setProperty("--scrollbar-track", config.track);
  root.style.setProperty("--scrollbar-border", config.border);
  root.style.setProperty("--scrollbar-hover", config.hover);
}

/**
 * Reads the current theme- class from <html> and applies scrollbar tokens.
 */
export function applyCurrentScrollbarTheme(): void {
  const classList = document.documentElement.classList;
  const themeClass = Array.from(classList).find((cls) =>
    cls.startsWith("theme-"),
  );

  if (themeClass) {
    updateScrollbarTheme(themeClass);
  }
}

/**
 * Watches for theme class changes on <html> and re-applies scrollbar tokens.
 */
export function initScrollbarThemeObserver(): void {
  applyCurrentScrollbarTheme();

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (
        mutation.type === "attributes" &&
        mutation.attributeName === "class"
      ) {
        applyCurrentScrollbarTheme();
      }
    });
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
}
