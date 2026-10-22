import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { configDefaults } from "vitest/config";

export default defineConfig(({ mode }) => ({
  plugins: [react(), tsconfigPaths()],
  server: {
    watch: {
      // The dev server watches the whole repo by default, which includes
      // the Java backend's build output. Maven rewrites target/ during
      // every compile, and chokidar's watcher died with EBUSY on a
      // migration file mid-write — taking the frontend down every time
      // `mvnw test` ran. Nothing under billing-backend is a frontend
      // source. The backup dumps at the repo root are large and inert.
      ignored: [
        "**/billing-backend/**",
        "**/firestore-backup-*/**",
        "**/full-wipe-backup-*/**",
        "**/*.sql",
      ],
    },
  },
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          // Keep React in main vendor chunk
          vendor: ["react", "react-dom"],
          "vendor-router": ["react-router-dom"],
          "vendor-heroui": [
            "@heroui/react",
            "@heroui/system",
            "@heroui/theme",
            "@heroui/modal",
            "@heroui/select",
          ],
          "vendor-firebase": [
            "firebase/app",
            "firebase/auth",
            "firebase/firestore",
          ],
          "vendor-charts": ["chart.js", "react-chartjs-2"],
          "vendor-utils": ["date-fns", "crypto-js", "clsx", "uuid"],
        },
      },
    },
    // Ensure proper minification
    minify: "esbuild",
    // Prevent over-aggressive optimization that might break event handling
    target: "es2020",
  },
  // Critical: Ensure React is properly resolved
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  // Make sure React is available globally in production. Scoped to actual
  // production builds (mode defaults to "production" for `vite build` and
  // "development"/"test" for `vite dev`/`vitest` respectively, so this was
  // already a no-op for the build output) — previously hardcoded
  // unconditionally, which forced React's production bundle even under
  // vitest and broke React Testing Library outright ("act(...) is not
  // supported in production builds of React").
  define: {
    "process.env.NODE_ENV": JSON.stringify(
      mode === "production" ? "production" : "development",
    ),
  },
  // Ensure proper event handling in production
  esbuild: {
    keepNames: true,
    legalComments: "none",
    // Remove console logs in production builds
    drop: mode === "production" ? ["console", "debugger"] : [],
  },
  test: {
    // .claude/worktrees/** holds scratch git worktrees created by background
    // agent tooling (each a full checkout, so it duplicates every test file
    // in the repo) — without this, a leftover worktree gets picked up by
    // vitest's default glob and its tests run (and can fail) alongside the
    // real suite, which has nothing to do with any actual code change.
    // tests/** holds the Firestore security-rules suite, which needs the
    // Firestore emulator and is run by `npm run test:rules`, not vitest.
    exclude: [...configDefaults.exclude, ".claude/**", "tests/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      // Reported for every service file (visibility into the 56/69 gap a
      // 2026-10-18 audit found — this had to be counted by hand before,
      // with no tool configured at all), but the threshold below is
      // enforced only on core/: pure calculation, no Firestore calls, and
      // already fully covered. Widening the threshold to the wider
      // service layer is tracked separately (tier 3) — enforcing it now
      // would fail CI on the pre-existing gap immediately rather than on
      // a regression.
      include: ["src/services/**/*.ts"],
      exclude: [
        "src/services/**/__tests__/**",
        "src/services/**/*.test.ts",
        "src/services/**/*.test.tsx",
      ],
      thresholds: {
        "src/services/core/**/*.ts": {
          statements: 90,
          branches: 85,
          functions: 90,
          lines: 90,
        },
      },
    },
  },
}));
