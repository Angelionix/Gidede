import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: [
      "src/**/*.test.ts",
      "src/**/*.spec.ts",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: [
        "src/lib/concept/**/*.ts",
        "src/lib/coreloop/**/*.ts",
        "src/lib/mda/**/*.ts",
        "src/lib/mechanics-db.ts",
        "src/lib/mechanics-taxonomy.ts",
      ],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.spec.ts",
        "src/**/types.ts",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
