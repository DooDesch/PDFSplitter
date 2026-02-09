import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["__tests__/**/*.test.ts"],
    globals: false,
  },
  resolve: {
    alias: {
      "@pdf-splitter/pdf-processor": resolve(__dirname, "./src/index.ts"),
    },
  },
});
