import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: { alias: { "@": fileURLToPath(new URL("./apps/web/src", import.meta.url)) } },
  test: {
    include: ["packages/*/tests/**/*.test.ts", "apps/*/tests/**/*.test.ts"],
    // Upstream route tests call handlers directly. In tests only, allow an
    // implicit test tenant so every existing feature test keeps working.
    env: { AUTH_DISABLED: "1" },
    testTimeout: 30000,
  },
});
