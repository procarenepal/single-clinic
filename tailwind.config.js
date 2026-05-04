import { heroui } from "@heroui/theme"

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    './src/layouts/**/*.{js,ts,jsx,tsx,mdx}',
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    {
      pattern: /(bg|text|border)-(nepal|mountain|health|saffron|teal)-(50|100|200|300|400|500|600|700|800|900)/,
    },
    {
      pattern: /hover:(bg|text|border)-(nepal|mountain|health|saffron|teal)-(50|100|200|300|400|500|600|700|800|900)/,
    },
  ],
  theme: {
    extend: {
      colors: {
        // ── HSC Purple (redefined from teal for branding) ───────────
        'teal': {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
          950: '#2e1065',
        },
        // ── Semantic Semantic Colors ────────────────────────────────────────
        'surface': 'rgb(var(--color-surface) / <alpha-value>)',
        'surface-2': 'rgb(var(--color-surface-2) / <alpha-value>)',
        'bg': 'rgb(var(--color-bg) / <alpha-value>)',
        'border-base': 'rgb(var(--color-border) / <alpha-value>)',
        'text-main': 'rgb(var(--color-text) / <alpha-value>)',
        'text-muted': 'rgb(var(--color-text-muted) / <alpha-value>)',

        // ── Legacy colors (backward compat) ─────────────────────────────────
        'nepal': {
          50: '#f0f9ff', 100: '#e0f2fe', 200: '#bae6fd', 300: '#7dd3fc',
          400: '#38bdf8', 500: '#0ea5e9', 600: '#0284c7', 700: '#0369a1',
          800: '#075985', 900: '#0c4a6e',
        },
        'mountain': {
          50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0', 300: '#cbd5e1',
          400: '#94a3b8', 500: '#64748b', 600: '#475569', 700: '#334155',
          800: '#1e293b', 900: '#0f172a',
        },
        'health': {
          50: '#f0fdf4', 100: '#dcfce7', 200: '#bbf7d0', 300: '#86efac',
          400: '#4ade80', 500: '#22c55e', 600: '#16a34a', 700: '#15803d',
          800: '#166534', 900: '#14532d',
        },
        'saffron': {
          50: '#fefdf3', 100: '#fefae6', 200: '#fef3c7', 300: '#fde68a',
          400: '#fcd34d', 500: '#f59e0b', 600: '#d97706', 700: '#b45309',
          800: '#92400e', 900: '#78350f',
        },
      },

      fontFamily: {
        'sans': ['Nunito', 'Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
        'mono': ['JetBrains Mono', 'Fira Code', 'monospace'],
        'nepali': ['Noto Sans Devanagari', 'sans-serif'],
      },

      // ── Semantic type scale (Clinic Clarity) ─────────────────────────────
      // Preflight resets all h1–h6 to inherit — these classes restore hierarchy.
      fontSize: {
        // Page-level headings
        'page-title': ['15px', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '700' }],
        'section-title': ['14px', { lineHeight: '1.3', letterSpacing: '-0.01em', fontWeight: '600' }],
        'card-title': ['13px', { lineHeight: '1.4', letterSpacing: '0', fontWeight: '600' }],
        // Body & UI chrome
        'body': ['13px', { lineHeight: '1.5', letterSpacing: '-0.01em', fontWeight: '400' }],
        'label': ['12px', { lineHeight: '1.4', letterSpacing: '0', fontWeight: '500' }],
        'micro': ['11px', { lineHeight: '1.4', letterSpacing: '0.06em', fontWeight: '600' }],
        // KPI stat values
        'stat': ['20px', { lineHeight: '1', letterSpacing: '-0.03em', fontWeight: '700' }],
        'stat-sm': ['15px', { lineHeight: '1', letterSpacing: '-0.02em', fontWeight: '700' }],
      },

      // ── Compact radius (flat corners) ────────────────────────────────────
      borderRadius: {
        'none': '0',
        'xs': '0.125rem',
        'sm': '0.375rem',
        DEFAULT: '0.5rem',
        'md': '0.5rem',
        'lg': '0.625rem',
        'xl': '0.75rem',
        '2xl': '1rem',
        'full': '9999px',
      },

      // ── Zero shadows (flat design — borders only) ─────────────────────────
      boxShadow: {
        'none': 'none',
        'focus-teal': '0 0 0 3px rgba(3, 86, 161, 0.18)',
        'focus-rose': '0 0 0 3px rgba(225, 29, 72, 0.18)',
        'focus-violet': '0 0 0 3px rgba(124, 58, 237, 0.18)',
        'focus-sky': '0 0 0 3px rgba(2, 132, 199, 0.18)',
        // Legacy names → none (maintain flat aesthetic)
        'sm': 'none',
        'md': 'none',
        'lg': 'none',
        'xl': 'none',
      },
    },
  },

  darkMode: "class",

  plugins: [heroui({
    // CRITICAL: HeroUI reads `extend` to know which base semantic colors to inherit.
    // Without `extend: 'light'` or `extend: 'dark'`, content1/content2/divider/
    // background/foreground vars are NOT generated and the theme appears broken.

    themes: {
      // ── 1. Clarity Light (default) ────────────────────────────────────────
      light: {
        // No `extend` needed — `light` IS a base theme in HeroUI
        colors: {
          background: '#f8fafc',
          foreground: '#0f172a',
          primary: {
            '50': '#f5f3ff',
            '100': '#ede9fe',
            '200': '#ddd6fe',
            '300': '#c4b5fd',
            '400': '#a78bfa',
            '500': '#8b5cf6',
            '600': '#7c3aed',
            '700': '#6d28d9',
            '800': '#5b21b6',
            '900': '#4c1d95',
            DEFAULT: '#7c3aed',
            foreground: '#ffffff',
          },
          secondary: {
            '50': '#f0fdf4',
            '100': '#dcfce7',
            '200': '#bbf7d0',
            '300': '#86efac',
            '400': '#4ade80',
            '500': '#22c55e',
            '600': '#16a34a',
            '700': '#15803d',
            DEFAULT: '#16a34a',
            foreground: '#ffffff',
          },
          success: {
            DEFAULT: '#16a34a',
            foreground: '#ffffff',
          },
          warning: {
            DEFAULT: '#d97706',
            foreground: '#ffffff',
          },
          danger: {
            DEFAULT: '#e11d48',
            foreground: '#ffffff',
          },
          focus: '#0356a1',
        },
      },

      // ── 2. Clarity Dark ───────────────────────────────────────────────────
      dark: {
        colors: {
          background: '#09090b',
          foreground: '#fafafa',
          primary: {
            '50': '#f5f3ff',
            '100': '#ede9fe',
            '200': '#ddd6fe',
            '300': '#c4b5fd',
            '400': '#a78bfa',
            '500': '#8b5cf6',
            '600': '#7c3aed',
            '700': '#6d28d9',
            DEFAULT: '#a78bfa',
            foreground: '#2e1065',
          },
          secondary: {
            DEFAULT: '#4ade80',
            foreground: '#14532d',
          },
          success: {
            DEFAULT: '#4ade80',
            foreground: '#14532d',
          },
          warning: {
            DEFAULT: '#fbbf24',
            foreground: '#000000',
          },
          danger: {
            DEFAULT: '#fb7185',
            foreground: '#000000',
          },
          focus: '#38a9f8',
          content1: '#151517',
          content2: '#242427',
          content3: '#27272a',
          content4: '#3f3f42',
          divider: 'rgba(255, 255, 255, 0.1)',
        },
      },

      // ── 3. Rose Clinic ────────────────────────────────────────────────────
      // `extend: 'light'` tells HeroUI to inherit all base semantic tokens
      // (content1, content2, content3, divider, overlay, etc.) from the light
      // theme, and only override the colors we specify here.
      'rose-clinic': {
        extend: 'light',
        colors: {
          background: '#fff1f2',
          foreground: '#881337',
          primary: {
            '50': '#fff1f2',
            '100': '#ffe4e6',
            '200': '#fecdd3',
            '300': '#fda4af',
            '400': '#fb7185',
            '500': '#f43f5e',
            '600': '#e11d48',
            '700': '#be123c',
            '800': '#9f1239',
            '900': '#881337',
            DEFAULT: '#e11d48',
            foreground: '#ffffff',
          },
          secondary: {
            '50': '#fdf4ff',
            '100': '#fae8ff',
            '200': '#f5d0fe',
            '300': '#f0abfc',
            '400': '#e879f9',
            '500': '#d946ef',
            '600': '#c026d3',
            DEFAULT: '#c026d3',
            foreground: '#ffffff',
          },
          success: {
            DEFAULT: '#16a34a',
            foreground: '#ffffff',
          },
          warning: {
            DEFAULT: '#d97706',
            foreground: '#ffffff',
          },
          danger: {
            DEFAULT: '#be123c',
            foreground: '#ffffff',
          },
          focus: '#e11d48',
        },
      },

      // ── 4. Violet Clinical ────────────────────────────────────────────────
      'violet-clinical': {
        extend: 'light',
        colors: {
          background: '#f5f3ff',
          foreground: '#4c1d95',
          primary: {
            '50': '#f5f3ff',
            '100': '#ede9fe',
            '200': '#ddd6fe',
            '300': '#c4b5fd',
            '400': '#a78bfa',
            '500': '#8b5cf6',
            '600': '#7c3aed',
            '700': '#6d28d9',
            '800': '#5b21b6',
            '900': '#4c1d95',
            DEFAULT: '#7c3aed',
            foreground: '#ffffff',
          },
          secondary: {
            '50': '#f0fdfa',
            '100': '#ccfbf1',
            '500': '#14b8a6',
            '600': '#0d9488',
            DEFAULT: '#0d9488',
            foreground: '#ffffff',
          },
          success: {
            DEFAULT: '#16a34a',
            foreground: '#ffffff',
          },
          warning: {
            DEFAULT: '#d97706',
            foreground: '#ffffff',
          },
          danger: {
            DEFAULT: '#e11d48',
            foreground: '#ffffff',
          },
          focus: '#7c3aed',
        },
      },

      // ── 5. Carbon Dark ────────────────────────────────────────────────────
      'carbon-dark': {
        extend: 'dark',
        colors: {
          background: '#09090b',
          foreground: '#f4f4f5',
          primary: {
            '50': '#f0fdfa',
            '100': '#ccfbf1',
            '400': '#2dd4bf',
            '500': '#14b8a6',
            '600': '#0d9488',
            '700': '#0f766e',
            DEFAULT: '#0d9488',
            foreground: '#ffffff',
          },
          secondary: {
            '700': '#3f3f46',
            '800': '#27272a',
            '900': '#18181b',
            DEFAULT: '#3f3f46',
            foreground: '#f4f4f5',
          },
          success: {
            DEFAULT: '#22c55e',
            foreground: '#ffffff',
          },
          warning: {
            DEFAULT: '#f59e0b',
            foreground: '#ffffff',
          },
          danger: {
            DEFAULT: '#ef4444',
            foreground: '#ffffff',
          },
          focus: '#0d9488',
        },
      },

      // ── 6. Arctic ─────────────────────────────────────────────────────────
      'arctic': {
        extend: 'light',
        colors: {
          background: '#f8fafc',
          foreground: '#0f172a',
          primary: {
            '50': '#f0f9ff',
            '100': '#e0f2fe',
            '200': '#bae6fd',
            '300': '#7dd3fc',
            '400': '#38bdf8',
            '500': '#0ea5e9',
            '600': '#0284c7',
            '700': '#0369a1',
            '800': '#075985',
            '900': '#0c4a6e',
            DEFAULT: '#0284c7',
            foreground: '#ffffff',
          },
          secondary: {
            '400': '#94a3b8',
            '500': '#64748b',
            '600': '#475569',
            DEFAULT: '#64748b',
            foreground: '#ffffff',
          },
          success: {
            DEFAULT: '#16a34a',
            foreground: '#ffffff',
          },
          warning: {
            DEFAULT: '#d97706',
            foreground: '#ffffff',
          },
          danger: {
            DEFAULT: '#e11d48',
            foreground: '#ffffff',
          },
          focus: '#0284c7',
        },
      },

      // ── Legacy themes (kept for backward compat) ──────────────────────────
      medical: {
        extend: 'light',
        colors: {
          background: '#f8fafc',
          foreground: '#1e293b',
          primary: {
            '500': '#3b82f6',
            '600': '#2563eb',
            DEFAULT: '#2563eb',
            foreground: '#ffffff',
          },
          secondary: {
            DEFAULT: '#10b981',
            foreground: '#ffffff',
          },
          focus: '#2563eb',
        },
      },
      nature: {
        extend: 'light',
        colors: {
          background: '#f0fdf4',
          foreground: '#14532d',
          primary: {
            DEFAULT: '#16a34a',
            foreground: '#ffffff',
          },
          secondary: {
            DEFAULT: '#10b981',
            foreground: '#ffffff',
          },
          focus: '#16a34a',
        },
      },
      ocean: {
        extend: 'light',
        colors: {
          background: '#f0fdfa',
          foreground: '#0f766e',
          primary: {
            DEFAULT: '#0891b2',
            foreground: '#ffffff',
          },
          secondary: {
            DEFAULT: '#3b82f6',
            foreground: '#ffffff',
          },
          focus: '#0891b2',
        },
      },
      sunset: {
        extend: 'light',
        colors: {
          background: '#fffbeb',
          foreground: '#78350f',
          primary: {
            DEFAULT: '#ea580c',
            foreground: '#ffffff',
          },
          secondary: {
            DEFAULT: '#eab308',
            foreground: '#ffffff',
          },
          focus: '#ea580c',
        },
      },
    },
  })],
}
