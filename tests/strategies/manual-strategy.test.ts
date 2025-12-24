/**
 * Tests for ManualStrategyExecutor
 * Universal Verification Strategy (UVS) Phase 3
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Feature } from "../../src/types.js";
import type { ManualVerificationStrategy } from "../../src/verifier/types/index.js";
import {
  ManualStrategyExecutor,
  manualStrategyExecutor,
  type UserInputInterface,
} from "../../src/strategies/manual-strategy.js";
import { defaultRegistry } from "../../src/strategy-executor.js";

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

/**
 * Mock user input for testing
 */
class MockUserInput implements UserInputInterface {
  private yesNoResponses: boolean[] = [];
  private checklistResponses: boolean[][] = [];

  setYesNoResponses(...responses: boolean[]): void {
    this.yesNoResponses = responses;
  }

  setChecklistResponses(...responses: boolean[][]): void {
    this.checklistResponses = responses;
  }

  async askYesNo(_question: string): Promise<boolean> {
    const response = this.yesNoResponses.shift();
    return response ?? false;
  }

  async askChecklist(items: string[]): Promise<boolean[]> {
    const responses = this.checklistResponses.shift();
    return responses ?? items.map(() => false);
  }
}

describe("ManualStrategyExecutor", () => {
  let executor: ManualStrategyExecutor;
  let mockInput: MockUserInput;
  let originalCI: string | undefined;

  beforeEach(() => {
    mockInput = new MockUserInput();
    executor = new ManualStrategyExecutor(mockInput);
    originalCI = process.env.CI;
    // Ensure not in CI mode for most tests
    delete process.env.CI;
    vi.clearAllMocks();
    // Suppress console output during tests
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    if (originalCI !== undefined) {
      process.env.CI = originalCI;
    } else {
      delete process.env.CI;
    }
    vi.restoreAllMocks();
  });

  describe("type property", () => {
    it("should have type 'manual'", () => {
      expect(executor.type).toBe("manual");
    });
  });

  describe("CI environment", () => {
    it("should fail in CI environment", async () => {
      process.env.CI = "true";

      const strategy: ManualVerificationStrategy = {
        type: "manual",
        required: true,
        instructions: "Please review the changes",
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(false);
      expect(result.output).toContain("cannot complete in CI environment");
      expect(result.details?.reason).toBe("ci-environment");
    });

    it("should include strategy details in CI failure", async () => {
      process.env.CI = "true";

      const strategy: ManualVerificationStrategy = {
        type: "manual",
        required: true,
        instructions: "Review instructions",
        checklist: ["Item 1", "Item 2"],
        assignee: "qa-team",
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.details?.instructions).toBe("Review instructions");
      expect(result.details?.checklist).toEqual(["Item 1", "Item 2"]);
      expect(result.details?.assignee).toBe("qa-team");
    });
  });

  describe("yes/no confirmation", () => {
    it("should pass when user confirms yes", async () => {
      mockInput.setYesNoResponses(true);

      const strategy: ManualVerificationStrategy = {
        type: "manual",
        required: true,
        instructions: "Verify the feature works",
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(true);
      expect(result.output).toContain("passed");
      expect(result.details?.approved).toBe(true);
    });

    it("should fail when user confirms no", async () => {
      mockInput.setYesNoResponses(false);

      const strategy: ManualVerificationStrategy = {
        type: "manual",
        required: true,
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(false);
      expect(result.output).toContain("rejected");
      expect(result.details?.approved).toBe(false);
    });
  });

  describe("checklist verification", () => {
    it("should pass when all checklist items are completed", async () => {
      mockInput.setChecklistResponses([true, true, true]);

      const strategy: ManualVerificationStrategy = {
        type: "manual",
        required: true,
        checklist: ["Review code", "Run tests", "Update docs"],
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(true);
      expect(result.output).toContain("passed");
    });

    it("should fail when some checklist items are not completed", async () => {
      mockInput.setChecklistResponses([true, false, true]);

      const strategy: ManualVerificationStrategy = {
        type: "manual",
        required: true,
        checklist: ["Review code", "Run tests", "Update docs"],
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(false);
      expect(result.output).toContain("incomplete");
      expect(result.details?.reason).toBe("checklist-incomplete");
      expect(result.details?.incompleteItems).toContain("Run tests");
    });

    it("should fail when all checklist items are incomplete", async () => {
      mockInput.setChecklistResponses([false, false, false]);

      const strategy: ManualVerificationStrategy = {
        type: "manual",
        required: true,
        checklist: ["Item 1", "Item 2", "Item 3"],
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(false);
      expect(result.details?.incompleteItems).toHaveLength(3);
    });

    it("should include checklist results in details", async () => {
      mockInput.setChecklistResponses([true, false, true]);

      const strategy: ManualVerificationStrategy = {
        type: "manual",
        required: true,
        checklist: ["A", "B", "C"],
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.details?.results).toEqual([true, false, true]);
    });
  });

  describe("assignee/reviewer", () => {
    it("should use assignee field", async () => {
      mockInput.setYesNoResponses(true);

      const strategy: ManualVerificationStrategy = {
        type: "manual",
        required: true,
        assignee: "security-team",
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.details?.assignee).toBe("security-team");
    });

    it("should fall back to reviewer field", async () => {
      mockInput.setYesNoResponses(true);

      const strategy: ManualVerificationStrategy = {
        type: "manual",
        required: true,
        reviewer: "qa-team",
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.details?.assignee).toBe("qa-team");
    });

    it("should prefer assignee over reviewer", async () => {
      mockInput.setYesNoResponses(true);

      const strategy: ManualVerificationStrategy = {
        type: "manual",
        required: true,
        assignee: "assignee-team",
        reviewer: "reviewer-team",
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.details?.assignee).toBe("assignee-team");
    });
  });

  describe("instructions", () => {
    it("should include instructions in details", async () => {
      mockInput.setYesNoResponses(true);

      const strategy: ManualVerificationStrategy = {
        type: "manual",
        required: true,
        instructions: "Please verify the UI matches the design",
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.details?.instructions).toBe("Please verify the UI matches the design");
    });
  });

  describe("setUserInput", () => {
    it("should allow setting user input after construction", async () => {
      const executor2 = new ManualStrategyExecutor();
      const newMockInput = new MockUserInput();
      newMockInput.setYesNoResponses(true);
      executor2.setUserInput(newMockInput);

      const strategy: ManualVerificationStrategy = {
        type: "manual",
        required: true,
      };

      const result = await executor2.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(true);
    });
  });

  describe("return value details", () => {
    it("should include duration", async () => {
      mockInput.setYesNoResponses(true);

      const strategy: ManualVerificationStrategy = {
        type: "manual",
        required: true,
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it("should include all strategy info in details", async () => {
      mockInput.setYesNoResponses(true);

      const strategy: ManualVerificationStrategy = {
        type: "manual",
        required: true,
        instructions: "Test instructions",
        checklist: undefined,
        assignee: "test-team",
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.details?.instructions).toBe("Test instructions");
      expect(result.details?.assignee).toBe("test-team");
      expect(result.details?.approved).toBe(true);
    });
  });
});

describe("manualStrategyExecutor singleton", () => {
  it("should be a ManualStrategyExecutor instance", () => {
    expect(manualStrategyExecutor).toBeInstanceOf(ManualStrategyExecutor);
  });

  it("should have type 'manual'", () => {
    expect(manualStrategyExecutor.type).toBe("manual");
  });
});

describe("defaultRegistry integration", () => {
  it("should have manual executor registered", () => {
    expect(defaultRegistry.has("manual")).toBe(true);
  });

  it("should return manualStrategyExecutor for 'manual' type", () => {
    const executor = defaultRegistry.get("manual");
    expect(executor).toBe(manualStrategyExecutor);
  });
});

describe("error handling", () => {
  let executor: ManualStrategyExecutor;
  let originalCI: string | undefined;

  beforeEach(() => {
    originalCI = process.env.CI;
    delete process.env.CI;
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    if (originalCI !== undefined) {
      process.env.CI = originalCI;
    } else {
      delete process.env.CI;
    }
    vi.restoreAllMocks();
  });

  it("should handle errors thrown during checklist processing", async () => {
    const errorInput: UserInputInterface = {
      async askYesNo(_question: string): Promise<boolean> {
        throw new Error("Input error");
      },
      async askChecklist(_items: string[]): Promise<boolean[]> {
        throw new Error("Checklist error");
      },
    };

    executor = new ManualStrategyExecutor(errorInput);

    const strategy: ManualVerificationStrategy = {
      type: "manual",
      required: true,
      checklist: ["Item 1"],
    };

    const result = await executor.execute("/project", strategy, baseFeature);

    expect(result.success).toBe(false);
    expect(result.output).toContain("failed");
    expect(result.details?.reason).toBe("error");
    expect(result.details?.error).toBe("Checklist error");
  });

  it("should handle errors thrown during yes/no confirmation", async () => {
    const errorInput: UserInputInterface = {
      async askYesNo(_question: string): Promise<boolean> {
        throw new Error("Confirmation error");
      },
      async askChecklist(_items: string[]): Promise<boolean[]> {
        return [];
      },
    };

    executor = new ManualStrategyExecutor(errorInput);

    const strategy: ManualVerificationStrategy = {
      type: "manual",
      required: true,
      // No checklist - uses yes/no
    };

    const result = await executor.execute("/project", strategy, baseFeature);

    expect(result.success).toBe(false);
    expect(result.output).toContain("failed");
    expect(result.details?.error).toBe("Confirmation error");
  });

  it("should include duration even when error occurs", async () => {
    const errorInput: UserInputInterface = {
      async askYesNo(_question: string): Promise<boolean> {
        throw new Error("Test error");
      },
      async askChecklist(_items: string[]): Promise<boolean[]> {
        throw new Error("Test error");
      },
    };

    executor = new ManualStrategyExecutor(errorInput);

    const strategy: ManualVerificationStrategy = {
      type: "manual",
      required: true,
    };

    const result = await executor.execute("/project", strategy, baseFeature);

    expect(result.duration).toBeGreaterThanOrEqual(0);
  });
});

describe("CLIUserInput", () => {
  // Note: CLIUserInput is difficult to test directly because it uses readline
  // These tests verify the class structure and interface compliance
  it("should export CLIUserInput class", async () => {
    const module = await import("../../src/strategies/manual-strategy.js");
    expect(module.CLIUserInput).toBeDefined();
  });

  it("should implement UserInputInterface", async () => {
    const module = await import("../../src/strategies/manual-strategy.js");
    const instance = new module.CLIUserInput();
    expect(typeof instance.askYesNo).toBe("function");
    expect(typeof instance.askChecklist).toBe("function");
  });
});

describe("edge cases", () => {
  let executor: ManualStrategyExecutor;
  let mockInput: MockUserInput;
  let originalCI: string | undefined;

  beforeEach(() => {
    mockInput = new MockUserInput();
    executor = new ManualStrategyExecutor(mockInput);
    originalCI = process.env.CI;
    delete process.env.CI;
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    if (originalCI !== undefined) {
      process.env.CI = originalCI;
    } else {
      delete process.env.CI;
    }
    vi.restoreAllMocks();
  });

  it("should handle empty checklist array", async () => {
    mockInput.setYesNoResponses(true);

    const strategy: ManualVerificationStrategy = {
      type: "manual",
      required: true,
      checklist: [], // Empty checklist
    };

    const result = await executor.execute("/project", strategy, baseFeature);

    // Empty checklist should fall through to yes/no confirmation
    expect(result.success).toBe(true);
  });

  it("should handle strategy with no instructions", async () => {
    mockInput.setYesNoResponses(true);

    const strategy: ManualVerificationStrategy = {
      type: "manual",
      required: true,
      // No instructions
    };

    const result = await executor.execute("/project", strategy, baseFeature);

    expect(result.success).toBe(true);
    expect(result.details?.instructions).toBeUndefined();
  });

  it("should handle feature with minimal properties", async () => {
    mockInput.setYesNoResponses(true);

    const minimalFeature: Feature = {
      id: "min",
      description: "Minimal",
      module: "m",
      priority: 1,
      status: "failing",
      acceptance: [],
      dependsOn: [],
      supersedes: [],
      tags: [],
      version: 1,
      origin: "manual",
      notes: "",
    };

    const strategy: ManualVerificationStrategy = {
      type: "manual",
      required: true,
    };

    const result = await executor.execute("/project", strategy, minimalFeature);

    expect(result.success).toBe(true);
  });

  it("should handle single item checklist", async () => {
    mockInput.setChecklistResponses([true]);

    const strategy: ManualVerificationStrategy = {
      type: "manual",
      required: true,
      checklist: ["Single item"],
    };

    const result = await executor.execute("/project", strategy, baseFeature);

    expect(result.success).toBe(true);
  });

  it("should handle very long checklist", async () => {
    const longChecklist = Array.from({ length: 20 }, (_, i) => `Item ${i + 1}`);
    mockInput.setChecklistResponses(longChecklist.map(() => true));

    const strategy: ManualVerificationStrategy = {
      type: "manual",
      required: true,
      checklist: longChecklist,
    };

    const result = await executor.execute("/project", strategy, baseFeature);

    expect(result.success).toBe(true);
  });
});
