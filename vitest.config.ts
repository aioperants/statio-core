import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: { include: ["src/**/*.test.ts", "src/**/*.test.tsx"] },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // Server-only modules are tested directly, outside Next.js.
      "server-only": path.resolve(__dirname, "src/test/empty.ts"),
    },
  },
  esbuild: { jsx: "automatic" },
});
