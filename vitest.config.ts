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
        "src/lib/balance/**/*.ts",
        "src/lib/economy/**/*.ts",
        "src/lib/gdd/**/*.ts",
        "src/lib/mechanics-db.ts",
        "src/lib/mechanics-taxonomy.ts",
        "src/lib/mechanic-ref.ts",
        "src/lib/pipeline-context.ts",
        "src/lib/checklist-logic.ts",
        "src/lib/algorithm-metadata.ts",
        "src/lib/contracts/stage-contracts.ts",
        "src/lib/contracts/artifact-envelope.ts",
      ],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.spec.ts",
        "src/**/types.ts",
      ],
      // R7-08: CI thresholds — domain logic ≥80%, contracts ≥70%.
      thresholds: {
        lines: 70,
        functions: 70,
        statements: 70,
        branches: 60,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
