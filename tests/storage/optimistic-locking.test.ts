/**
 * Tests for optimistic locking functionality
 * Tests conflict detection, retry logic, and version tracking
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  OptimisticLockError,
  IndexConflictError,
  FeatureConflictError,
  withOptimisticRetry,
  loadFeatureIndex,
  saveFeatureIndex,
  loadSingleFeature,
  saveSingleFeature,
  saveSingleFeatureFrontmatterOnly,
} from "../../src/storage/index.js";
import type { Feature, FeatureIndex, FeatureIndexWithLock } from "../../src/types/index.js";

describe("OptimisticLockError classes", () => {
  it("should create IndexConflictError with correct properties", () => {
    const error = new IndexConflictError("2024-01-01T00:00:00Z", "2024-01-02T00:00:00Z");

    expect(error).toBeInstanceOf(OptimisticLockError);
    expect(error).toBeInstanceOf(IndexConflictError);
    expect(error.name).toBe("IndexConflictError");
    expect(error.resourceType).toBe("index");
    expect(error.resourceId).toBe("index.json");
    expect(error.expectedUpdatedAt).toBe("2024-01-01T00:00:00Z");
    expect(error.actualUpdatedAt).toBe("2024-01-02T00:00:00Z");
  });

  it("should create FeatureConflictError with correct properties", () => {
    const error = new FeatureConflictError("auth.login", 1, 2);

    expect(error).toBeInstanceOf(OptimisticLockError);
    expect(error).toBeInstanceOf(FeatureConflictError);
    expect(error.name).toBe("FeatureConflictError");
    expect(error.resourceType).toBe("feature");
    expect(error.resourceId).toBe("auth.login");
    expect(error.expectedVersion).toBe(1);
    expect(error.actualVersion).toBe(2);
  });
});

describe("withOptimisticRetry", () => {
  it("should return result on first successful attempt", async () => {
    const result = await withOptimisticRetry(async () => "success");
    expect(result).toBe("success");
  });

  it("should retry on OptimisticLockError and succeed", async () => {
    let attempts = 0;
    const result = await withOptimisticRetry(
      async () => {
        attempts++;
        if (attempts < 2) {
          throw new IndexConflictError("t1", "t2");
        }
        return "success after retry";
      },
      { maxRetries: 3, baseDelayMs: 1, maxDelayMs: 10 }
    );

    expect(attempts).toBe(2);
    expect(result).toBe("success after retry");
  });

  it("should throw after max retries exhausted", async () => {
    let attempts = 0;

    await expect(
      withOptimisticRetry(
        async () => {
          attempts++;
          throw new IndexConflictError("t1", "t2");
        },
        { maxRetries: 3, baseDelayMs: 1, maxDelayMs: 10 }
      )
    ).rejects.toThrow(IndexConflictError);

    expect(attempts).toBe(3);
  });

  it("should throw non-retryable errors immediately", async () => {
    let attempts = 0;

    await expect(
      withOptimisticRetry(
        async () => {
          attempts++;
          throw new Error("Not a lock error");
        },
        { maxRetries: 3, baseDelayMs: 1, maxDelayMs: 10 }
      )
    ).rejects.toThrow("Not a lock error");

    expect(attempts).toBe(1);
  });

  it("should apply exponential backoff", async () => {
    const delays: number[] = [];
    let lastTime = Date.now();
    let attempts = 0;

    try {
      await withOptimisticRetry(
        async () => {
          const now = Date.now();
          if (attempts > 0) {
            delays.push(now - lastTime);
          }
          lastTime = now;
          attempts++;
          throw new FeatureConflictError("test", 1, 2);
        },
        { maxRetries: 3, baseDelayMs: 20, maxDelayMs: 200 }
      );
    } catch {
      // Expected to throw
    }

    // Should have 2 delays (between 1st-2nd and 2nd-3rd attempts)
    expect(delays.length).toBe(2);
    // Second delay should be roughly 2x first (exponential backoff)
    // Allow some tolerance for timing
    expect(delays[1]).toBeGreaterThan(delays[0] * 1.5);
  });
});

describe("Index optimistic locking", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "opt-lock-test-"));
    await fs.mkdir(path.join(tempDir, "ai", "tasks"), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("should attach _loadedAt when loading index", async () => {
    const indexData: FeatureIndex = {
      version: "2.0.0",
      updatedAt: "2024-01-15T10:00:00Z",
      metadata: {
        projectGoal: "Test",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-15T10:00:00Z",
        version: "1.0.0",
      },
      features: {},
    };

    await fs.writeFile(
      path.join(tempDir, "ai", "tasks", "index.json"),
      JSON.stringify(indexData, null, 2)
    );

    const loaded = await loadFeatureIndex(tempDir);

    expect(loaded).not.toBeNull();
    expect(loaded!._loadedAt).toBe("2024-01-15T10:00:00Z");
  });

  it("should detect conflict when updatedAt changed", async () => {
    // Create initial index
    const indexData: FeatureIndex = {
      version: "2.0.0",
      updatedAt: "2024-01-15T10:00:00Z",
      metadata: {
        projectGoal: "Test",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-15T10:00:00Z",
        version: "1.0.0",
      },
      features: {},
    };

    const indexPath = path.join(tempDir, "ai", "tasks", "index.json");
    await fs.writeFile(indexPath, JSON.stringify(indexData, null, 2));

    // Load index (captures _loadedAt)
    const loaded = await loadFeatureIndex(tempDir);
    expect(loaded).not.toBeNull();

    // Simulate concurrent modification by updating the file directly
    const modifiedData = {
      ...indexData,
      updatedAt: "2024-01-15T11:00:00Z", // Different timestamp
    };
    await fs.writeFile(indexPath, JSON.stringify(modifiedData, null, 2));

    // Attempt to save should throw IndexConflictError
    await expect(saveFeatureIndex(tempDir, loaded!)).rejects.toThrow(IndexConflictError);
  });

  it("should save successfully when no conflict", async () => {
    // Create initial index
    const indexData: FeatureIndex = {
      version: "2.0.0",
      updatedAt: "2024-01-15T10:00:00Z",
      metadata: {
        projectGoal: "Test",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-15T10:00:00Z",
        version: "1.0.0",
      },
      features: {},
    };

    await fs.writeFile(
      path.join(tempDir, "ai", "tasks", "index.json"),
      JSON.stringify(indexData, null, 2)
    );

    // Load and save without external modification
    const loaded = await loadFeatureIndex(tempDir);
    loaded!.features["new.task"] = {
      status: "failing",
      priority: 1,
      module: "new",
      description: "New task",
    };

    await expect(saveFeatureIndex(tempDir, loaded!)).resolves.not.toThrow();

    // Verify the save worked
    const reloaded = await loadFeatureIndex(tempDir);
    expect(reloaded!.features["new.task"]).toBeDefined();
  });

  it("should strip _loadedAt from saved file", async () => {
    const indexData: FeatureIndex = {
      version: "2.0.0",
      updatedAt: "2024-01-15T10:00:00Z",
      metadata: {
        projectGoal: "Test",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-15T10:00:00Z",
        version: "1.0.0",
      },
      features: {},
    };

    const indexPath = path.join(tempDir, "ai", "tasks", "index.json");
    await fs.writeFile(indexPath, JSON.stringify(indexData, null, 2));

    const loaded = await loadFeatureIndex(tempDir);
    await saveFeatureIndex(tempDir, loaded!);

    // Read raw file and verify _loadedAt is not present
    const rawContent = await fs.readFile(indexPath, "utf-8");
    const parsed = JSON.parse(rawContent);

    expect(parsed._loadedAt).toBeUndefined();
  });
});

describe("Feature file version tracking", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "version-test-"));
    await fs.mkdir(path.join(tempDir, "ai", "tasks", "auth"), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  const createFeatureFile = async (version: number = 1) => {
    const content = `---
id: auth.login
module: auth
priority: 1
status: failing
version: ${version}
origin: manual
dependsOn: []
supersedes: []
tags: []
---

# User login feature

## Acceptance Criteria

1. User can login
`;
    await fs.writeFile(
      path.join(tempDir, "ai", "tasks", "auth", "login.md"),
      content
    );
  };

  it("should increment version on save", async () => {
    await createFeatureFile(1);

    const feature = await loadSingleFeature(tempDir, "auth.login");
    expect(feature).not.toBeNull();
    expect(feature!.version).toBe(1);

    await saveSingleFeature(tempDir, feature!);

    const reloaded = await loadSingleFeature(tempDir, "auth.login");
    expect(reloaded!.version).toBe(2);
  });

  it("should detect conflict when version differs", async () => {
    await createFeatureFile(1);

    const feature = await loadSingleFeature(tempDir, "auth.login");
    const originalVersion = feature!.version;

    // Simulate concurrent modification
    await createFeatureFile(5); // Version changed externally

    // Attempt save with original version should throw
    await expect(
      saveSingleFeature(tempDir, feature!, originalVersion)
    ).rejects.toThrow(FeatureConflictError);
  });

  it("should save successfully with matching version", async () => {
    await createFeatureFile(1);

    const feature = await loadSingleFeature(tempDir, "auth.login");
    const originalVersion = feature!.version;

    // Modify feature
    feature!.status = "passing";

    // Save with correct expected version
    await expect(
      saveSingleFeature(tempDir, feature!, originalVersion)
    ).resolves.not.toThrow();

    // Verify changes saved
    const reloaded = await loadSingleFeature(tempDir, "auth.login");
    expect(reloaded!.status).toBe("passing");
    expect(reloaded!.version).toBe(2);
  });

  it("should increment version in frontmatter-only save", async () => {
    await createFeatureFile(1);

    const feature = await loadSingleFeature(tempDir, "auth.login");
    feature!.status = "passing";

    await saveSingleFeatureFrontmatterOnly(tempDir, feature!);

    const reloaded = await loadSingleFeature(tempDir, "auth.login");
    expect(reloaded!.version).toBe(2);
  });

  it("should detect conflict in frontmatter-only save", async () => {
    await createFeatureFile(1);

    const feature = await loadSingleFeature(tempDir, "auth.login");
    const originalVersion = feature!.version;

    // Simulate concurrent modification
    await createFeatureFile(3);

    // Attempt frontmatter-only save with original version
    await expect(
      saveSingleFeatureFrontmatterOnly(tempDir, feature!, originalVersion)
    ).rejects.toThrow(FeatureConflictError);
  });
});
