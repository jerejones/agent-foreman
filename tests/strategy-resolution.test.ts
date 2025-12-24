/**
 * Tests for getVerificationStrategies and getDefaultStrategiesForTaskType
 * Universal Verification Strategy (UVS) Phase 2
 */
import { describe, it, expect } from "vitest";
import {
  getVerificationStrategies,
  getDefaultStrategiesForTaskType,
} from "../src/verifier/index.js";
import type { Feature } from "../src/types.js";
import type {
  TestVerificationStrategy,
  E2EVerificationStrategy,
  AiVerificationStrategy,
  ScriptVerificationStrategy,
  FileVerificationStrategy,
  CommandVerificationStrategy,
  ManualVerificationStrategy,
} from "../src/verifier/types/index.js";

// Base feature for testing
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

describe("getDefaultStrategiesForTaskType", () => {
  it("should return test + AI strategies for 'code' task type", () => {
    const strategies = getDefaultStrategiesForTaskType("code");

    expect(strategies).toHaveLength(2);
    expect(strategies[0].type).toBe("test");
    expect(strategies[0].required).toBe(false);
    expect(strategies[1].type).toBe("ai");
    expect(strategies[1].required).toBe(true);
  });

  it("should return script + AI strategies for 'ops' task type", () => {
    const strategies = getDefaultStrategiesForTaskType("ops");

    expect(strategies).toHaveLength(2);
    expect(strategies[0].type).toBe("script");
    expect(strategies[0].required).toBe(false);
    expect((strategies[0] as ScriptVerificationStrategy).path).toBe("./verify.sh");
    expect(strategies[1].type).toBe("ai");
    expect(strategies[1].required).toBe(true);
  });

  it("should return file + AI strategies for 'data' task type", () => {
    const strategies = getDefaultStrategiesForTaskType("data");

    expect(strategies).toHaveLength(2);
    expect(strategies[0].type).toBe("file");
    expect(strategies[0].required).toBe(false);
    expect(strategies[1].type).toBe("ai");
    expect(strategies[1].required).toBe(true);
  });

  it("should return command + AI strategies for 'infra' task type", () => {
    const strategies = getDefaultStrategiesForTaskType("infra");

    expect(strategies).toHaveLength(2);
    expect(strategies[0].type).toBe("command");
    expect(strategies[0].required).toBe(false);
    expect((strategies[0] as CommandVerificationStrategy).command).toBe("terraform validate");
    expect(strategies[1].type).toBe("ai");
    expect(strategies[1].required).toBe(true);
  });

  it("should return manual strategy for 'manual' task type", () => {
    const strategies = getDefaultStrategiesForTaskType("manual");

    expect(strategies).toHaveLength(1);
    expect(strategies[0].type).toBe("manual");
    expect(strategies[0].required).toBe(true);
  });
});

describe("getVerificationStrategies", () => {
  describe("resolution priority: explicit verificationStrategies", () => {
    it("should return explicit verificationStrategies when defined", () => {
      const feature: Feature = {
        ...baseFeature,
        verificationStrategies: [
          { type: "test", required: true, pattern: "tests/**/*.test.ts" },
          { type: "e2e", required: false, tags: ["@smoke"] },
        ],
      };

      const strategies = getVerificationStrategies(feature);

      expect(strategies).toHaveLength(2);
      expect(strategies[0].type).toBe("test");
      expect((strategies[0] as TestVerificationStrategy).pattern).toBe("tests/**/*.test.ts");
      expect(strategies[1].type).toBe("e2e");
      expect((strategies[1] as E2EVerificationStrategy).tags).toEqual(["@smoke"]);
    });

    it("should use explicit strategies even when testRequirements exists", () => {
      const feature: Feature = {
        ...baseFeature,
        verificationStrategies: [
          { type: "ai", required: true },
        ],
        testRequirements: {
          unit: { required: true, pattern: "tests/**/*.test.ts" },
        },
      };

      const strategies = getVerificationStrategies(feature);

      expect(strategies).toHaveLength(1);
      expect(strategies[0].type).toBe("ai");
    });

    it("should use explicit strategies even when taskType exists", () => {
      const feature: Feature = {
        ...baseFeature,
        taskType: "ops",
        verificationStrategies: [
          { type: "manual", required: true },
        ],
      };

      const strategies = getVerificationStrategies(feature);

      expect(strategies).toHaveLength(1);
      expect(strategies[0].type).toBe("manual");
    });
  });

  describe("resolution priority: legacy testRequirements", () => {
    it("should convert testRequirements when no explicit strategies", () => {
      const feature: Feature = {
        ...baseFeature,
        testRequirements: {
          unit: { required: true, pattern: "tests/**/*.test.ts" },
        },
      };

      const strategies = getVerificationStrategies(feature);

      expect(strategies).toHaveLength(1);
      expect(strategies[0].type).toBe("test");
      expect((strategies[0] as TestVerificationStrategy).required).toBe(true);
      expect((strategies[0] as TestVerificationStrategy).pattern).toBe("tests/**/*.test.ts");
    });

    it("should convert both unit and e2e testRequirements", () => {
      const feature: Feature = {
        ...baseFeature,
        testRequirements: {
          unit: { required: true },
          e2e: { required: false, tags: ["@auth"] },
        },
      };

      const strategies = getVerificationStrategies(feature);

      expect(strategies).toHaveLength(2);
      expect(strategies[0].type).toBe("test");
      expect(strategies[1].type).toBe("e2e");
      expect((strategies[1] as E2EVerificationStrategy).tags).toEqual(["@auth"]);
    });

    it("should use testRequirements over taskType defaults", () => {
      const feature: Feature = {
        ...baseFeature,
        taskType: "ops",
        testRequirements: {
          unit: { required: true, pattern: "tests/**/*.test.ts" },
        },
      };

      const strategies = getVerificationStrategies(feature);

      expect(strategies).toHaveLength(1);
      expect(strategies[0].type).toBe("test");
    });
  });

  describe("resolution priority: taskType defaults", () => {
    it("should use taskType defaults when no explicit strategies or testRequirements", () => {
      const feature: Feature = {
        ...baseFeature,
        taskType: "code",
      };

      const strategies = getVerificationStrategies(feature);

      expect(strategies).toHaveLength(2);
      expect(strategies[0].type).toBe("test");
      expect(strategies[1].type).toBe("ai");
    });

    it("should use ops defaults for ops taskType", () => {
      const feature: Feature = {
        ...baseFeature,
        taskType: "ops",
      };

      const strategies = getVerificationStrategies(feature);

      expect(strategies).toHaveLength(2);
      expect(strategies[0].type).toBe("script");
      expect(strategies[1].type).toBe("ai");
    });

    it("should use manual strategy for manual taskType", () => {
      const feature: Feature = {
        ...baseFeature,
        taskType: "manual",
      };

      const strategies = getVerificationStrategies(feature);

      expect(strategies).toHaveLength(1);
      expect(strategies[0].type).toBe("manual");
    });
  });

  describe("resolution priority: default to AI autonomous", () => {
    it("should default to AI when no strategies, testRequirements, or taskType", () => {
      const feature: Feature = { ...baseFeature };

      const strategies = getVerificationStrategies(feature);

      expect(strategies).toHaveLength(1);
      expect(strategies[0].type).toBe("ai");
      expect(strategies[0].required).toBe(true);
    });

    it("should default to AI for feature with empty testRequirements", () => {
      const feature: Feature = {
        ...baseFeature,
        testRequirements: {},
      };

      const strategies = getVerificationStrategies(feature);

      expect(strategies).toHaveLength(1);
      expect(strategies[0].type).toBe("ai");
    });

    it("should default to AI for feature with empty verificationStrategies", () => {
      const feature: Feature = {
        ...baseFeature,
        verificationStrategies: [],
      };

      const strategies = getVerificationStrategies(feature);

      expect(strategies).toHaveLength(1);
      expect(strategies[0].type).toBe("ai");
    });
  });

  describe("backward compatibility", () => {
    it("should work with existing features that have no new fields", () => {
      // Simulate an existing feature from before UVS
      const legacyFeature: Feature = {
        id: "legacy.feature",
        description: "Legacy feature",
        module: "legacy",
        priority: 1,
        status: "failing",
        acceptance: ["Works correctly"],
        dependsOn: [],
        supersedes: [],
        tags: [],
        version: 1,
        origin: "manual",
        notes: "",
      };

      const strategies = getVerificationStrategies(legacyFeature);

      expect(strategies).toHaveLength(1);
      expect(strategies[0].type).toBe("ai");
      expect(strategies[0].required).toBe(true);
    });

    it("should work with features using only testRequirements.unit", () => {
      const feature: Feature = {
        ...baseFeature,
        testRequirements: {
          unit: {
            required: true,
            pattern: "tests/auth/**/*.test.ts",
            cases: ["should login", "should logout"],
          },
        },
      };

      const strategies = getVerificationStrategies(feature);

      expect(strategies).toHaveLength(1);
      const testStrategy = strategies[0] as TestVerificationStrategy;
      expect(testStrategy.type).toBe("test");
      expect(testStrategy.required).toBe(true);
      expect(testStrategy.pattern).toBe("tests/auth/**/*.test.ts");
      expect(testStrategy.cases).toEqual(["should login", "should logout"]);
    });

    it("should work with features using testRequirements with e2e only", () => {
      const feature: Feature = {
        ...baseFeature,
        testRequirements: {
          e2e: {
            required: true,
            pattern: "e2e/**/*.spec.ts",
            tags: ["@smoke", "@critical"],
          },
        },
      };

      const strategies = getVerificationStrategies(feature);

      expect(strategies).toHaveLength(1);
      const e2eStrategy = strategies[0] as E2EVerificationStrategy;
      expect(e2eStrategy.type).toBe("e2e");
      expect(e2eStrategy.required).toBe(true);
      expect(e2eStrategy.tags).toEqual(["@smoke", "@critical"]);
    });
  });
});
