import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Global setup file for cleanup hooks
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      include: ["src/**/*.ts"],
      exclude: [
        // Entry point (CLI bootstrap)
        "src/index.ts",
        // Generated file (auto-generated, not testable)
        "src/embedded-assets.generated.ts",
        // Type-only files (no executable code)
        "src/**/types.ts",
        "src/types/**/*.ts",
        "src/verifier/types/**/*.ts",
        "src/strategies/types/**/*.ts",
        // Re-export wrapper files (module indexes)
        "src/gitignore/index.ts",
        "src/verification-store/index.ts",
        "src/tdd-guidance/index.ts",
        "src/verifier/index.ts",
        "src/verifier/types/index.ts",
        "src/agents/index.ts",
        "src/capabilities/index.ts",
        "src/features/index.ts",
        "src/init/index.ts",
        "src/scanner/index.ts",
        "src/schemas/index.ts",
        "src/storage/index.ts",
        "src/testing/index.ts",
        "src/ui/index.ts",
        "src/validation/index.ts",
        "src/prompts/index.ts",
        "src/progress/index.ts",
        "src/commands/index.ts",
        // Re-export wrappers at root level
        "src/agents.ts",
        "src/progress.ts",
        "src/prompts.ts",
        // Strategy index files (pure re-exports)
        "src/strategies/ai-strategy/index.ts",
        "src/strategies/command-strategy/index.ts",
        "src/strategies/file-strategy/index.ts",
        "src/strategies/http-strategy/index.ts",
        "src/strategies/script-strategy/index.ts",
        // Re-export wrapper files (backward compatibility)
        "src/strategies/ai-strategy.ts",
        "src/strategies/file-strategy.ts",
        "src/strategies/http-strategy.ts",
        // Thin wrapper around external agent (hard to unit test)
        "src/strategies/ai-strategy/agent.ts",
      ],
      reportsDirectory: "./coverage",
    },
    testTimeout: 30000,
    // Use 'forks' pool for better process isolation and cleanup
    // This ensures child processes spawned by tests are properly terminated
    pool: "forks",
    // Vitest 4: pool options are now top-level (not nested in poolOptions)
    isolate: true,
    // Timeout for cleanup when Vitest shuts down
    teardownTimeout: 5000,
    // Hook timeout for setup/teardown hooks
    hookTimeout: 30000,
  },
});
