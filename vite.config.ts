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
  // Make sure React is available globally in production
  define: {
    "process.env.NODE_ENV": '"production"',
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
    exclude: [...configDefaults.exclude, ".claude/**"],
  },
}));
