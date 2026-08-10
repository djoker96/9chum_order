import path from "node:path"
import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import tsconfigPaths from "vite-tsconfig-paths"

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: [path.resolve(__dirname, "test/setup.ts")],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: [
        "src/lib/invoice-number.ts",
        "src/lib/invoice-text.ts",
        "src/lib/money.ts",
        "src/server/auth/login.schema.ts",
        "src/server/auth/permissions.ts",
        "src/server/auth/rate-limit.ts",
        "src/server/auth/session-token.ts",
        "src/server/users/user.schema.ts",
        "src/server/users/user.service.ts",
        "src/server/http/security.ts",
        "src/server/invoices/invoice.service.ts",
        "src/server/products/google-sheet-config.ts",
        "src/server/products/google-sheets.ts",
        "src/server/products/google-sheet-config.service.ts",
        "src/server/products/product-sync.ts",
        "src/server/products/sync.service.ts",
        "src/server/validators/invoice.schema.ts",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
})
