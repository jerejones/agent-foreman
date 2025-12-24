/**
 * Tests for convertTestRequirementsToStrategies function
 * Universal Verification Strategy (UVS) Phase 2
 */
import { describe, it, expect } from "vitest";
import { convertTestRequirementsToStrategies } from "../src/verifier/index.js";
import type { TestRequirements } from "../src/types.js";
import type {
  TestVerificationStrategy,
  E2EVerificationStrategy,
} from "../src/verifier/types/index.js";

describe("convertTestRequirementsToStrategies", () => {
  describe("empty/undefined input", () => {
    it("should return empty array for undefined testRequirements", () => {
      const result = convertTestRequirementsToStrategies(undefined);
      expect(result).toEqual([]);
    });

    it("should return empty array for empty testRequirements object", () => {
      const testRequirements: TestRequirements = {};
      const result = convertTestRequirementsToStrategies(testRequirements);
      expect(result).toEqual([]);
    });
  });

  describe("unit test conversion", () => {
    it("should convert unit test requirements with required only", () => {
      const testRequirements: TestRequirements = {
        unit: {
          required: true,
        },
      };

      const result = convertTestRequirementsToStrategies(testRequirements);

      expect(result).toHaveLength(1);
      const strategy = result[0] as TestVerificationStrategy;
      expect(strategy.type).toBe("test");
      expect(strategy.required).toBe(true);
      expect(strategy.pattern).toBeUndefined();
      expect(strategy.cases).toBeUndefined();
    });

    it("should convert unit test requirements with pattern", () => {
      const testRequirements: TestRequirements = {
        unit: {
          required: false,
          pattern: "tests/**/*.test.ts",
        },
      };

      const result = convertTestRequirementsToStrategies(testRequirements);

      expect(result).toHaveLength(1);
      const strategy = result[0] as TestVerificationStrategy;
      expect(strategy.type).toBe("test");
      expect(strategy.required).toBe(false);
      expect(strategy.pattern).toBe("tests/**/*.test.ts");
    });

    it("should convert unit test requirements with cases", () => {
      const testRequirements: TestRequirements = {
        unit: {
          required: true,
          pattern: "tests/auth/**/*.test.ts",
          cases: ["should login successfully", "should reject invalid credentials"],
        },
      };

      const result = convertTestRequirementsToStrategies(testRequirements);

      expect(result).toHaveLength(1);
      const strategy = result[0] as TestVerificationStrategy;
      expect(strategy.type).toBe("test");
      expect(strategy.required).toBe(true);
      expect(strategy.pattern).toBe("tests/auth/**/*.test.ts");
      expect(strategy.cases).toEqual(["should login successfully", "should reject invalid credentials"]);
    });
  });

  describe("e2e test conversion", () => {
    it("should convert e2e test requirements with required only", () => {
      const testRequirements: TestRequirements = {
        e2e: {
          required: true,
        },
      };

      const result = convertTestRequirementsToStrategies(testRequirements);

      expect(result).toHaveLength(1);
      const strategy = result[0] as E2EVerificationStrategy;
      expect(strategy.type).toBe("e2e");
      expect(strategy.required).toBe(true);
      expect(strategy.pattern).toBeUndefined();
      expect(strategy.tags).toBeUndefined();
      expect(strategy.scenarios).toBeUndefined();
    });

    it("should convert e2e test requirements with pattern", () => {
      const testRequirements: TestRequirements = {
        e2e: {
          required: false,
          pattern: "e2e/**/*.spec.ts",
        },
      };

      const result = convertTestRequirementsToStrategies(testRequirements);

      expect(result).toHaveLength(1);
      const strategy = result[0] as E2EVerificationStrategy;
      expect(strategy.type).toBe("e2e");
      expect(strategy.required).toBe(false);
      expect(strategy.pattern).toBe("e2e/**/*.spec.ts");
    });

    it("should convert e2e test requirements with tags", () => {
      const testRequirements: TestRequirements = {
        e2e: {
          required: true,
          tags: ["@smoke", "@auth"],
        },
      };

      const result = convertTestRequirementsToStrategies(testRequirements);

      expect(result).toHaveLength(1);
      const strategy = result[0] as E2EVerificationStrategy;
      expect(strategy.type).toBe("e2e");
      expect(strategy.required).toBe(true);
      expect(strategy.tags).toEqual(["@smoke", "@auth"]);
    });

    it("should convert e2e test requirements with scenarios", () => {
      const testRequirements: TestRequirements = {
        e2e: {
          required: true,
          pattern: "e2e/auth/**/*.spec.ts",
          tags: ["@auth"],
          scenarios: ["user login flow", "password reset flow"],
        },
      };

      const result = convertTestRequirementsToStrategies(testRequirements);

      expect(result).toHaveLength(1);
      const strategy = result[0] as E2EVerificationStrategy;
      expect(strategy.type).toBe("e2e");
      expect(strategy.required).toBe(true);
      expect(strategy.pattern).toBe("e2e/auth/**/*.spec.ts");
      expect(strategy.tags).toEqual(["@auth"]);
      expect(strategy.scenarios).toEqual(["user login flow", "password reset flow"]);
    });
  });

  describe("combined unit and e2e", () => {
    it("should convert both unit and e2e test requirements", () => {
      const testRequirements: TestRequirements = {
        unit: {
          required: true,
          pattern: "tests/**/*.test.ts",
          cases: ["should work"],
        },
        e2e: {
          required: false,
          pattern: "e2e/**/*.spec.ts",
          tags: ["@smoke"],
          scenarios: ["user flow"],
        },
      };

      const result = convertTestRequirementsToStrategies(testRequirements);

      expect(result).toHaveLength(2);

      const unitStrategy = result[0] as TestVerificationStrategy;
      expect(unitStrategy.type).toBe("test");
      expect(unitStrategy.required).toBe(true);
      expect(unitStrategy.pattern).toBe("tests/**/*.test.ts");
      expect(unitStrategy.cases).toEqual(["should work"]);

      const e2eStrategy = result[1] as E2EVerificationStrategy;
      expect(e2eStrategy.type).toBe("e2e");
      expect(e2eStrategy.required).toBe(false);
      expect(e2eStrategy.pattern).toBe("e2e/**/*.spec.ts");
      expect(e2eStrategy.tags).toEqual(["@smoke"]);
      expect(e2eStrategy.scenarios).toEqual(["user flow"]);
    });
  });

  describe("backward compatibility", () => {
    it("should handle real-world testRequirements from existing features", () => {
      // Example from actual feature definition
      const testRequirements: TestRequirements = {
        unit: {
          required: true,
          pattern: "tests/verifier.test.ts",
        },
      };

      const result = convertTestRequirementsToStrategies(testRequirements);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("test");
      expect((result[0] as TestVerificationStrategy).pattern).toBe("tests/verifier.test.ts");
    });

    it("should preserve all fields when converting", () => {
      const testRequirements: TestRequirements = {
        unit: {
          required: true,
          pattern: "tests/auth/**/*.test.ts",
          cases: ["login", "logout", "refresh"],
        },
        e2e: {
          required: true,
          pattern: "e2e/auth/**/*.spec.ts",
          tags: ["@auth", "@critical"],
          scenarios: ["complete auth flow"],
        },
      };

      const result = convertTestRequirementsToStrategies(testRequirements);

      // Verify all unit fields are preserved
      const unitStrategy = result[0] as TestVerificationStrategy;
      expect(unitStrategy.required).toBe(testRequirements.unit!.required);
      expect(unitStrategy.pattern).toBe(testRequirements.unit!.pattern);
      expect(unitStrategy.cases).toEqual(testRequirements.unit!.cases);

      // Verify all e2e fields are preserved
      const e2eStrategy = result[1] as E2EVerificationStrategy;
      expect(e2eStrategy.required).toBe(testRequirements.e2e!.required);
      expect(e2eStrategy.pattern).toBe(testRequirements.e2e!.pattern);
      expect(e2eStrategy.tags).toEqual(testRequirements.e2e!.tags);
      expect(e2eStrategy.scenarios).toEqual(testRequirements.e2e!.scenarios);
    });
  });
});
