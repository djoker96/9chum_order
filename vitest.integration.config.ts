import path from "node:path"
import { defineConfig } from "vitest/config"
import tsconfigPaths from "vite-tsconfig-paths"

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    globals: true,
    include: ["test/integration/**/*.integration.test.ts"],
    pool: "forks",
    poolOptions: {
      forks: { singleFork: true },
    },
    setupFiles: [path.resolve(__dirname, "test/integration/setup.ts")],
  },
})
