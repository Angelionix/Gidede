import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  // We test server-side logic (crypto, graph compiler, RAG search) — no React
  // components. A node environment is enough and avoids jsdom overhead.
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/lib/**/*.ts"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
