/**
 * Tests for verification strategy types (UVS)
 * Universal Verification Strategy type definitions
 */
import { describe, it, expect } from "vitest";
import type {
  VerificationStrategyType,
  BaseVerificationStrategy,
  TestVerificationStrategy,
  E2EVerificationStrategy,
  ScriptVerificationStrategy,
  HttpVerificationStrategy,
  FileVerificationStrategy,
  CommandVerificationStrategy,
  ManualVerificationStrategy,
  AiVerificationStrategy,
  CompositeVerificationStrategy,
  VerificationStrategy,
} from "../src/verifier/types/index.js";
import type { Feature } from "../src/types.js";

describe("VerificationStrategyType", () => {
  it("should accept all valid strategy type values", () => {
    const validTypes: VerificationStrategyType[] = [
      "test",
      "e2e",
      "script",
      "http",
      "file",
      "command",
      "manual",
      "ai",
      "composite",
    ];
    expect(validTypes).toHaveLength(9);

    // Type check - each value should be assignable
    const test: VerificationStrategyType = "test";
    const e2e: VerificationStrategyType = "e2e";
    const script: VerificationStrategyType = "script";
    const http: VerificationStrategyType = "http";
    const file: VerificationStrategyType = "file";
    const command: VerificationStrategyType = "command";
    const manual: VerificationStrategyType = "manual";
    const ai: VerificationStrategyType = "ai";
    const composite: VerificationStrategyType = "composite";

    expect([test, e2e, script, http, file, command, manual, ai, composite]).toEqual(validTypes);
  });
});

describe("BaseVerificationStrategy", () => {
  it("should require type and required fields", () => {
    const base: BaseVerificationStrategy = {
      type: "test",
      required: true,
    };
    expect(base.type).toBe("test");
    expect(base.required).toBe(true);
  });

  it("should accept all optional fields", () => {
    const base: BaseVerificationStrategy = {
      type: "test",
      required: true,
      description: "Test description",
      timeout: 30000,
      retries: 3,
      env: { NODE_ENV: "test", CI: "true" },
    };
    expect(base.description).toBe("Test description");
    expect(base.timeout).toBe(30000);
    expect(base.retries).toBe(3);
    expect(base.env).toEqual({ NODE_ENV: "test", CI: "true" });
  });
});

describe("Strategy Interfaces", () => {
  it("TestVerificationStrategy extends BaseVerificationStrategy", () => {
    const strategy: TestVerificationStrategy = {
      type: "test",
      required: true,
      pattern: "tests/**/*.test.ts",
      cases: ["should create user", "should delete user"],
      framework: "vitest",
    };
    expect(strategy.type).toBe("test");
    expect(strategy.pattern).toBe("tests/**/*.test.ts");
    expect(strategy.cases).toHaveLength(2);
    expect(strategy.framework).toBe("vitest");
  });

  it("E2EVerificationStrategy extends BaseVerificationStrategy", () => {
    const strategy: E2EVerificationStrategy = {
      type: "e2e",
      required: false,
      pattern: "e2e/**/*.spec.ts",
      tags: ["@smoke", "@auth"],
      scenarios: ["login flow", "logout flow"],
      framework: "playwright",
    };
    expect(strategy.type).toBe("e2e");
    expect(strategy.tags).toContain("@smoke");
    expect(strategy.framework).toBe("playwright");
  });

  it("ScriptVerificationStrategy extends BaseVerificationStrategy", () => {
    const strategy: ScriptVerificationStrategy = {
      type: "script",
      required: true,
      path: "./scripts/verify.sh",
      args: ["--verbose", "--strict"],
      cwd: "/app",
      expectedExitCode: 0,
    };
    expect(strategy.type).toBe("script");
    expect(strategy.path).toBe("./scripts/verify.sh");
    expect(strategy.args).toEqual(["--verbose", "--strict"]);
  });

  it("HttpVerificationStrategy extends BaseVerificationStrategy", () => {
    const strategy: HttpVerificationStrategy = {
      type: "http",
      required: true,
      url: "https://api.example.com/health",
      method: "GET",
      headers: { Authorization: "Bearer token" },
      expectedStatus: 200,
      expectedBodyPattern: "\"status\":\"ok\"",
    };
    expect(strategy.type).toBe("http");
    expect(strategy.url).toBe("https://api.example.com/health");
    expect(strategy.method).toBe("GET");
    expect(strategy.expectedStatus).toBe(200);
  });

  it("FileVerificationStrategy extends BaseVerificationStrategy", () => {
    const strategy: FileVerificationStrategy = {
      type: "file",
      required: true,
      path: "./dist/index.js",
      exists: true,
      containsPattern: "export default",
      sizeConstraint: { min: 1000, max: 100000 },
    };
    expect(strategy.type).toBe("file");
    expect(strategy.path).toBe("./dist/index.js");
    expect(strategy.exists).toBe(true);
    expect(strategy.sizeConstraint?.min).toBe(1000);
  });

  it("CommandVerificationStrategy extends BaseVerificationStrategy", () => {
    const strategy: CommandVerificationStrategy = {
      type: "command",
      required: true,
      command: "node",
      args: ["--version"],
      cwd: ".",
      expectedExitCode: 0,
      expectedOutputPattern: "v\\d+\\.\\d+\\.\\d+",
    };
    expect(strategy.type).toBe("command");
    expect(strategy.command).toBe("node");
    expect(strategy.expectedOutputPattern).toMatch(/\\d/);
  });

  it("ManualVerificationStrategy extends BaseVerificationStrategy", () => {
    const strategy: ManualVerificationStrategy = {
      type: "manual",
      required: true,
      instructions: "Review the UI changes",
      checklist: ["Check responsive design", "Verify accessibility"],
      reviewer: "qa",
    };
    expect(strategy.type).toBe("manual");
    expect(strategy.instructions).toBe("Review the UI changes");
    expect(strategy.checklist).toHaveLength(2);
    expect(strategy.reviewer).toBe("qa");
  });

  it("AiVerificationStrategy extends BaseVerificationStrategy", () => {
    const strategy: AiVerificationStrategy = {
      type: "ai",
      required: true,
      model: "claude",
      promptTemplate: "Verify: {criteria}",
      minConfidence: 0.8,
    };
    expect(strategy.type).toBe("ai");
    expect(strategy.model).toBe("claude");
    expect(strategy.minConfidence).toBe(0.8);
  });

  it("CompositeVerificationStrategy extends BaseVerificationStrategy", () => {
    const testStrategy: TestVerificationStrategy = {
      type: "test",
      required: true,
    };
    const fileStrategy: FileVerificationStrategy = {
      type: "file",
      required: true,
      path: "./dist/index.js",
    };

    const strategy: CompositeVerificationStrategy = {
      type: "composite",
      required: true,
      operator: "and",
      strategies: [testStrategy, fileStrategy],
    };
    expect(strategy.type).toBe("composite");
    expect(strategy.operator).toBe("and");
    expect(strategy.strategies).toHaveLength(2);
  });
});

describe("VerificationStrategy union type", () => {
  it("should accept any strategy interface", () => {
    const strategies: VerificationStrategy[] = [
      { type: "test", required: true },
      { type: "e2e", required: false },
      { type: "script", required: true, path: "./test.sh" },
      { type: "http", required: true, url: "http://localhost" },
      { type: "file", required: true, path: "./file.txt" },
      { type: "command", required: true, command: "echo" },
      { type: "manual", required: true },
      { type: "ai", required: true },
      { type: "composite", required: true, operator: "or", strategies: [] },
    ];

    expect(strategies).toHaveLength(9);
    expect(strategies.map((s) => s.type)).toEqual([
      "test",
      "e2e",
      "script",
      "http",
      "file",
      "command",
      "manual",
      "ai",
      "composite",
    ]);
  });
});

describe("Feature with verificationStrategies", () => {
  const baseFeature: Feature = {
    id: "test.feature",
    description: "Test feature",
    module: "test",
    priority: 1,
    status: "failing",
    acceptance: ["Acceptance criterion"],
    dependsOn: [],
    supersedes: [],
    tags: [],
    version: 1,
    origin: "manual",
    notes: "",
  };

  it("should accept feature without verificationStrategies (backward compatible)", () => {
    const feature: Feature = { ...baseFeature };
    expect(feature.verificationStrategies).toBeUndefined();
  });

  it("should accept feature with empty verificationStrategies array", () => {
    const feature: Feature = {
      ...baseFeature,
      verificationStrategies: [],
    };
    expect(feature.verificationStrategies).toHaveLength(0);
  });

  it("should accept feature with verificationStrategies array", () => {
    const feature: Feature = {
      ...baseFeature,
      verificationStrategies: [
        { type: "test", required: true, pattern: "tests/**/*.test.ts" },
        { type: "e2e", required: false, tags: ["@smoke"] },
      ],
    };
    expect(feature.verificationStrategies).toHaveLength(2);
    expect(feature.verificationStrategies?.[0].type).toBe("test");
    expect(feature.verificationStrategies?.[1].type).toBe("e2e");
  });

  it("should work with taskType and verificationStrategies together", () => {
    const feature: Feature = {
      ...baseFeature,
      taskType: "ops",
      verificationStrategies: [
        { type: "script", required: true, path: "./deploy.sh" },
        { type: "http", required: true, url: "http://localhost/health" },
      ],
    };
    expect(feature.taskType).toBe("ops");
    expect(feature.verificationStrategies).toHaveLength(2);
  });
});
