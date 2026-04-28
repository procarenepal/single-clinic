import React, { createContext, useContext, useEffect, useState } from "react";

import { updateScrollbarTheme } from "@/utils/scrollbarTheme";

// ── Theme variant IDs ──────────────────────────────────────────────────────────
// New "Clinic Clarity" design language primary variants + legacy kept for compat
export type ThemeVariant =
  | "light" // Clinic Clarity Light  (new primary)
  | "dark" // Clinic Clarity Dark   (new primary dark)
  | "rose-clinic" // New: Rose / feminine medical
  | "violet-clinical" // New: Violet / analytical premium
  | "carbon-dark" // New: Near-black ultra-dark
  | "arctic" // New: Sky-blue crisp minimal
  // Legacy (kept for backward compat)
  | "medical"
  | "nature"
  | "ocean"
  | "sunset";

export interface ThemeConfig {
  id: ThemeVariant;
  name: string;
  description: string;
  isNew?: boolean;
  isDarkTheme?: boolean;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
  };
  preview: {
    background: string;
    card: string;
    primary: string;
  };
}

const themes: Record<ThemeVariant, ThemeConfig> = {
  // ─────────────────────────────────────────────────────
  // Clinic Clarity — New Design Language
  // ─────────────────────────────────────────────────────
  light: {
    id: "light",
    name: "Clarity Light",
    description: "Modern ProCare Blue interface",
    isNew: true,
    colors: {
      primary: "teal-700",
      secondary: "health-500",
      accent: "saffron-500",
      background: "slate-50",
      surface: "white",
      text: "slate-900",
      textSecondary: "slate-500",
    },
    preview: {
      background: "bg-slate-100",
      card: "bg-white border border-slate-200",
      primary: "bg-teal-700",
    },
  },
  dark: {
    id: "dark",
    name: "Clarity Dark",
    description: "Premium dark mode interface",
    isNew: true,
    isDarkTheme: true,
    colors: {
      primary: "teal-400",
      secondary: "health-400",
      accent: "saffron-400",
      background: "zinc-950",
      surface: "zinc-900",
      text: "zinc-50",
      textSecondary: "zinc-400",
    },
    preview: {
      background: "bg-zinc-900",
      card: "bg-zinc-800 border border-zinc-700",
      primary: "bg-teal-400",
    },
  },
  "rose-clinic": {
    id: "rose-clinic",
    name: "Rose Clinic",
    description: "Warm rose — feminine healthcare",
    isNew: true,
    colors: {
      primary: "rose-600",
      secondary: "fuchsia-500",
      accent: "pink-400",
      background: "rose-50",
      surface: "white",
      text: "rose-950",
      textSecondary: "rose-700",
    },
    preview: {
      background: "bg-rose-100",
      card: "bg-white border border-rose-200",
      primary: "bg-rose-600",
    },
  },
  "violet-clinical": {
    id: "violet-clinical",
    name: "Violet Clinical",
    description: "Deep violet — analytical premium",
    isNew: true,
    colors: {
      primary: "violet-600",
      secondary: "teal-600",
      accent: "indigo-400",
      background: "violet-50",
      surface: "white",
      text: "violet-950",
      textSecondary: "violet-700",
    },
    preview: {
      background: "bg-violet-100",
      card: "bg-white border border-violet-200",
      primary: "bg-violet-600",
    },
  },
  "carbon-dark": {
    id: "carbon-dark",
    name: "Carbon Dark",
    description: "Near-black, ultra-focused night mode",
    isNew: true,
    isDarkTheme: true,
    colors: {
      primary: "teal-600",
      secondary: "zinc-600",
      accent: "teal-400",
      background: "zinc-950",
      surface: "zinc-950",
      text: "zinc-50",
      textSecondary: "zinc-400",
    },
    preview: {
      background: "bg-zinc-950",
      card: "bg-zinc-900 border border-zinc-800",
      primary: "bg-teal-600",
    },
  },
  arctic: {
    id: "arctic",
    name: "Arctic",
    description: "Sky blue — crisp minimal",
    isNew: true,
    colors: {
      primary: "sky-600",
      secondary: "slate-500",
      accent: "cyan-500",
      background: "slate-50",
      surface: "white",
      text: "slate-900",
      textSecondary: "slate-500",
    },
    preview: {
      background: "bg-slate-100",
      card: "bg-white border border-sky-100",
      primary: "bg-sky-600",
    },
  },

  // ─────────────────────────────────────────────────────
  // Legacy themes (backward-compat, unchanged)
  // ─────────────────────────────────────────────────────
  medical: {
    id: "medical",
    name: "Medical Blue",
    description: "Classic medical blue",
    colors: {
      primary: "blue-600",
      secondary: "cyan-500",
      accent: "teal-500",
      background: "slate-50",
      surface: "white",
      text: "slate-900",
      textSecondary: "slate-600",
    },
    preview: {
      background: "bg-slate-100",
      card: "bg-white border border-slate-200",
      primary: "bg-blue-600",
    },
  },
  nature: {
    id: "nature",
    name: "Natural Green",
    description: "Calming green therapy theme",
    colors: {
      primary: "health-600",
      secondary: "emerald-500",
      accent: "lime-500",
      background: "green-50",
      surface: "white",
      text: "green-900",
      textSecondary: "green-700",
    },
    preview: {
      background: "bg-green-100",
      card: "bg-white border border-green-200",
      primary: "bg-green-600",
    },
  },
  ocean: {
    id: "ocean",
    name: "Ocean Blue",
    description: "Calm and serene ocean theme",
    colors: {
      primary: "cyan-600",
      secondary: "blue-500",
      accent: "indigo-500",
      background: "cyan-50",
      surface: "white",
      text: "cyan-900",
      textSecondary: "cyan-700",
    },
    preview: {
      background: "bg-cyan-100",
      card: "bg-white border border-cyan-200",
      primary: "bg-cyan-600",
    },
  },
  sunset: {
    id: "sunset",
    name: "Warm Sunset",
    description: "Warm and welcoming theme",
    colors: {
      primary: "orange-500",
      secondary: "amber-500",
      accent: "yellow-500",
      background: "orange-50",
      surface: "white",
      text: "orange-900",
      textSecondary: "orange-700",
    },
    preview: {
      background: "bg-orange-100",
      card: "bg-white border border-orange-200",
      primary: "bg-orange-500",
    },
  },
};

// ── Context types ──────────────────────────────────────────────────────────────
interface ThemeContextType {
  currentTheme: ThemeVariant;
  themeConfig: ThemeConfig;
  themes: Record<ThemeVariant, ThemeConfig>;
  setTheme: (theme: ThemeVariant) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [currentTheme, setCurrentTheme] = useState<ThemeVariant>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("clinic-theme");

      return (saved as ThemeVariant) || "light";
    }

    return "light";
  });

  const themeConfig = themes[currentTheme];
  // Consider dark if the theme is explicitly a dark variant
  const isDark = themeConfig.isDarkTheme === true || currentTheme === "dark";

  const setTheme = (theme: ThemeVariant) => {
    setCurrentTheme(theme);
    localStorage.setItem("clinic-theme", theme);
  };

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;

    // ── Step 1: Remove ALL previous theme classes ──────────────────────────
    const ALL_THEME_IDS: ThemeVariant[] = [
      "light",
      "dark",
      "rose-clinic",
      "violet-clinical",
      "carbon-dark",
      "arctic",
      "medical",
      "nature",
      "ocean",
      "sunset",
    ];

    ALL_THEME_IDS.forEach((t) => {
      root.classList.remove(t, `theme-${t}`);
    });

    // ── Step 2: Apply via data-theme attribute (HeroUI canonical approach) ──
    // HeroUI generates CSS for: `.themeName, [data-theme="themeName"]`
    // Using data-theme avoids class specificity conflicts.
    root.setAttribute("data-theme", currentTheme);

    // ── Step 3: Also add as class for our own CSS custom properties ─────────
    root.classList.add(currentTheme);
    root.classList.add(`theme-${currentTheme}`);

    // ── Step 4: dark/light color-scheme for HeroUI ───────────────────────────
    if (isDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    // ── Step 5: Update scrollbar CSS vars ───────────────────────────────────
    updateScrollbarTheme(`theme-${currentTheme}`);
  }, [currentTheme, isDark]);

  const value: ThemeContextType = {
    currentTheme,
    themeConfig,
    themes,
    setTheme,
    isDark,
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }

  return context;
}
