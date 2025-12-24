/**
 * Tests for HttpStrategyExecutor
 * Universal Verification Strategy (UVS) Phase 3
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Feature } from "../../src/types.js";
import type { HttpVerificationStrategy } from "../../src/verifier/types/index.js";

// Use vi.hoisted to define mocks that will be available when vi.mock factories run
const { mockFetch } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
}));

// Mock global fetch
vi.stubGlobal("fetch", mockFetch);

// Import after mocks are defined
import { HttpStrategyExecutor, httpStrategyExecutor } from "../../src/strategies/http-strategy.js";
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

// Helper to create mock Response
function createMockResponse(status: number, body: string, ok = true): Response {
  return {
    status,
    ok,
    text: () => Promise.resolve(body),
    json: () => Promise.resolve(JSON.parse(body)),
    headers: new Headers(),
  } as unknown as Response;
}

describe("HttpStrategyExecutor", () => {
  let executor: HttpStrategyExecutor;

  beforeEach(() => {
    executor = new HttpStrategyExecutor();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("type property", () => {
    it("should have type 'http'", () => {
      expect(executor.type).toBe("http");
    });
  });

  describe("execute", () => {
    it("should execute HTTP GET request successfully", async () => {
      mockFetch.mockResolvedValue(createMockResponse(200, '{"status": "ok"}'));

      const strategy: HttpVerificationStrategy = {
        type: "http",
        required: true,
        url: "http://localhost:3000/health",
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(true);
      expect(result.details?.statusCode).toBe(200);
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3000/health",
        expect.objectContaining({ method: "GET" })
      );
    });

    it("should execute HTTP POST request with body", async () => {
      mockFetch.mockResolvedValue(createMockResponse(201, '{"id": 123}'));

      const strategy: HttpVerificationStrategy = {
        type: "http",
        required: true,
        url: "http://localhost:3000/api/users",
        method: "POST",
        body: { name: "John" },
        expectedStatus: 201,
      };

      await executor.execute("/project", strategy, baseFeature);

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/users",
        expect.objectContaining({
          method: "POST",
          body: '{"name":"John"}',
        })
      );
    });

    it("should fail when status code does not match", async () => {
      mockFetch.mockResolvedValue(createMockResponse(404, "Not Found", false));

      const strategy: HttpVerificationStrategy = {
        type: "http",
        required: true,
        url: "http://localhost:3000/health",
        expectedStatus: 200,
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(false);
      expect(result.details?.statusMatch).toBe(false);
    });

    it("should support array of expected status codes", async () => {
      mockFetch.mockResolvedValue(createMockResponse(201, '{"created": true}'));

      const strategy: HttpVerificationStrategy = {
        type: "http",
        required: true,
        url: "http://localhost:3000/api/items",
        method: "POST",
        expectedStatus: [200, 201, 204],
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(true);
      expect(result.details?.statusMatch).toBe(true);
    });

    it("should support response body pattern matching", async () => {
      mockFetch.mockResolvedValue(createMockResponse(200, '{"status": "healthy", "version": "1.2.3"}'));

      const strategy: HttpVerificationStrategy = {
        type: "http",
        required: true,
        url: "http://localhost:3000/health",
        expectedBodyPattern: '"status":\\s*"healthy"',
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(true);
      expect(result.details?.patternMatch).toBe(true);
    });

    it("should fail when pattern does not match", async () => {
      mockFetch.mockResolvedValue(createMockResponse(200, '{"status": "unhealthy"}'));

      const strategy: HttpVerificationStrategy = {
        type: "http",
        required: true,
        url: "http://localhost:3000/health",
        expectedBodyPattern: '"status":\\s*"healthy"',
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(false);
      expect(result.details?.patternMatch).toBe(false);
    });

    it("should support JSON assertions", async () => {
      mockFetch.mockResolvedValue(
        createMockResponse(200, '{"data": {"user": {"name": "John", "active": true}}}')
      );

      const strategy: HttpVerificationStrategy = {
        type: "http",
        required: true,
        url: "http://localhost:3000/api/user",
        jsonAssertions: [
          { path: "data.user.name", expected: "John" },
          { path: "data.user.active", expected: true },
        ],
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(true);
      expect(result.details?.jsonAssertionsMatch).toBe(true);
    });

    it("should fail when JSON assertion fails", async () => {
      mockFetch.mockResolvedValue(
        createMockResponse(200, '{"data": {"user": {"name": "Jane"}}}')
      );

      const strategy: HttpVerificationStrategy = {
        type: "http",
        required: true,
        url: "http://localhost:3000/api/user",
        jsonAssertions: [{ path: "data.user.name", expected: "John" }],
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(false);
      expect(result.details?.jsonAssertionsMatch).toBe(false);
      expect(result.details?.jsonAssertionErrors).toHaveLength(1);
    });

    it("should support environment variable substitution in URL", async () => {
      mockFetch.mockResolvedValue(createMockResponse(200, "OK"));

      const originalEnv = process.env.TEST_PORT;
      process.env.TEST_PORT = "8080";

      try {
        const strategy: HttpVerificationStrategy = {
          type: "http",
          required: true,
          url: "http://localhost:${TEST_PORT}/health",
        };

        await executor.execute("/project", strategy, baseFeature);

        expect(mockFetch).toHaveBeenCalledWith(
          "http://localhost:8080/health",
          expect.any(Object)
        );
      } finally {
        if (originalEnv === undefined) {
          delete process.env.TEST_PORT;
        } else {
          process.env.TEST_PORT = originalEnv;
        }
      }
    });

    it("should use custom headers", async () => {
      mockFetch.mockResolvedValue(createMockResponse(200, "OK"));

      const strategy: HttpVerificationStrategy = {
        type: "http",
        required: true,
        url: "http://localhost:3000/api",
        headers: {
          Authorization: "Bearer token123",
          "X-Custom-Header": "custom-value",
        },
      };

      await executor.execute("/project", strategy, baseFeature);

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3000/api",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer token123",
            "X-Custom-Header": "custom-value",
          }),
        })
      );
    });

    it("should handle request timeout", async () => {
      // Simulate a fetch that never resolves within timeout
      mockFetch.mockImplementation(
        () =>
          new Promise((_, reject) => {
            const error = new Error("Aborted");
            error.name = "AbortError";
            setTimeout(() => reject(error), 10);
          })
      );

      const strategy: HttpVerificationStrategy = {
        type: "http",
        required: true,
        url: "http://localhost:3000/slow",
        timeout: 5,
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(false);
      expect(result.output).toContain("timed out");
      expect(result.details?.reason).toBe("timeout");
    });

    it("should handle network error", async () => {
      mockFetch.mockRejectedValue(new Error("Network error: ECONNREFUSED"));

      const strategy: HttpVerificationStrategy = {
        type: "http",
        required: true,
        url: "http://localhost:3000/health",
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(false);
      expect(result.output).toContain("Network error");
      expect(result.details?.reason).toBe("request-failed");
    });
  });

  describe("SSRF prevention", () => {
    it("should allow localhost by default", async () => {
      mockFetch.mockResolvedValue(createMockResponse(200, "OK"));

      const strategy: HttpVerificationStrategy = {
        type: "http",
        required: true,
        url: "http://localhost:3000/api",
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(true);
    });

    it("should allow 127.0.0.1 by default", async () => {
      mockFetch.mockResolvedValue(createMockResponse(200, "OK"));

      const strategy: HttpVerificationStrategy = {
        type: "http",
        required: true,
        url: "http://127.0.0.1:3000/api",
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(true);
    });

    it("should block external hosts by default", async () => {
      const strategy: HttpVerificationStrategy = {
        type: "http",
        required: true,
        url: "http://example.com/api",
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(false);
      expect(result.details?.reason).toBe("ssrf-blocked");
      expect(result.output).toContain("not in allowed hosts");
    });

    it("should allow custom allowed hosts", async () => {
      mockFetch.mockResolvedValue(createMockResponse(200, "OK"));

      const strategy: HttpVerificationStrategy = {
        type: "http",
        required: true,
        url: "http://api.example.com/health",
        allowedHosts: ["api.example.com", "localhost"],
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(true);
    });

    it("should support wildcard in allowed hosts", async () => {
      mockFetch.mockResolvedValue(createMockResponse(200, "OK"));

      const strategy: HttpVerificationStrategy = {
        type: "http",
        required: true,
        url: "http://api.staging.example.com/health",
        allowedHosts: ["*.example.com"],
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(true);
    });

    it("should block invalid URLs", async () => {
      const strategy: HttpVerificationStrategy = {
        type: "http",
        required: true,
        url: "not-a-valid-url",
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(false);
      expect(result.details?.reason).toBe("ssrf-blocked");
      expect(result.output).toContain("Invalid URL");
    });
  });

  describe("return value details", () => {
    it("should include URL and method in details", async () => {
      mockFetch.mockResolvedValue(createMockResponse(200, "OK"));

      const strategy: HttpVerificationStrategy = {
        type: "http",
        required: true,
        url: "http://localhost:3000/api",
        method: "POST",
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.details?.url).toBe("http://localhost:3000/api");
      expect(result.details?.method).toBe("POST");
    });

    it("should include status code information", async () => {
      mockFetch.mockResolvedValue(createMockResponse(201, '{"id": 1}'));

      const strategy: HttpVerificationStrategy = {
        type: "http",
        required: true,
        url: "http://localhost:3000/api",
        expectedStatus: 201,
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.details?.statusCode).toBe(201);
      expect(result.details?.expectedStatus).toBe(201);
      expect(result.details?.statusMatch).toBe(true);
    });
  });
});

describe("httpStrategyExecutor singleton", () => {
  it("should be an HttpStrategyExecutor instance", () => {
    expect(httpStrategyExecutor).toBeInstanceOf(HttpStrategyExecutor);
  });

  it("should have type 'http'", () => {
    expect(httpStrategyExecutor.type).toBe("http");
  });
});

describe("defaultRegistry integration", () => {
  it("should have http executor registered", () => {
    expect(defaultRegistry.has("http")).toBe(true);
  });

  it("should return httpStrategyExecutor for 'http' type", () => {
    const executor = defaultRegistry.get("http");
    expect(executor).toBe(httpStrategyExecutor);
  });
});

// ============================================================================
// Assertion functions tests - improve coverage for assertions.ts
// ============================================================================

import {
  checkStatusMatch,
  checkJsonAssertions,
  getJsonPath,
  deepEqual,
} from "../../src/strategies/http-strategy/assertions.js";

describe("checkStatusMatch", () => {
  it("should return true when status matches single expected value", () => {
    expect(checkStatusMatch(200, 200)).toBe(true);
  });

  it("should return false when status does not match single expected value", () => {
    expect(checkStatusMatch(404, 200)).toBe(false);
  });

  it("should return true when status is in expected array", () => {
    expect(checkStatusMatch(201, [200, 201, 204])).toBe(true);
  });

  it("should return false when status is not in expected array", () => {
    expect(checkStatusMatch(500, [200, 201, 204])).toBe(false);
  });
});

describe("getJsonPath", () => {
  it("should return value at simple path", () => {
    const obj = { data: { user: { name: "John" } } };
    expect(getJsonPath(obj, "data.user.name")).toBe("John");
  });

  it("should return undefined for non-existent path", () => {
    const obj = { data: {} };
    expect(getJsonPath(obj, "data.user.name")).toBeUndefined();
  });

  it("should handle array index access", () => {
    const obj = { items: [{ id: 1 }, { id: 2 }] };
    expect(getJsonPath(obj, "items[0].id")).toBe(1);
    expect(getJsonPath(obj, "items[1].id")).toBe(2);
  });

  it("should return array for wildcard operator", () => {
    const obj = { items: [{ id: 1 }, { id: 2 }] };
    expect(getJsonPath(obj, "items[*]")).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it("should return undefined when accessing property on null", () => {
    const obj = { data: null };
    expect(getJsonPath(obj, "data.user")).toBeUndefined();
  });

  it("should return undefined when accessing property on undefined", () => {
    const obj: Record<string, unknown> = {};
    expect(getJsonPath(obj, "data.user")).toBeUndefined();
  });

  it("should return undefined when accessing property on primitive", () => {
    const obj = { data: "string" };
    expect(getJsonPath(obj, "data.length")).toBeUndefined();
  });

  it("should handle array index on non-array", () => {
    const obj = { data: { "0": "zero" } };
    expect(getJsonPath(obj, "data[0]")).toBe("zero");
  });
});

describe("deepEqual", () => {
  it("should return true for identical primitives", () => {
    expect(deepEqual(1, 1)).toBe(true);
    expect(deepEqual("hello", "hello")).toBe(true);
    expect(deepEqual(true, true)).toBe(true);
  });

  it("should return false for different primitives", () => {
    expect(deepEqual(1, 2)).toBe(false);
    expect(deepEqual("hello", "world")).toBe(false);
  });

  it("should return false for different types", () => {
    expect(deepEqual(1, "1")).toBe(false);
    expect(deepEqual(true, 1)).toBe(false);
  });

  it("should handle null comparisons", () => {
    expect(deepEqual(null, null)).toBe(true);
    expect(deepEqual(null, undefined)).toBe(false);
    expect(deepEqual(null, {})).toBe(false);
  });

  it("should compare arrays deeply", () => {
    expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
    expect(deepEqual([1, [2, 3]], [1, [2, 3]])).toBe(true);
  });

  it("should return false for arrays with different lengths", () => {
    expect(deepEqual([1, 2, 3], [1, 2])).toBe(false);
  });

  it("should compare objects deeply", () => {
    expect(deepEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
    expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(deepEqual({ a: { b: 1 } }, { a: { b: 1 } })).toBe(true);
  });

  it("should return false for objects with different keys", () => {
    expect(deepEqual({ a: 1 }, { b: 1 })).toBe(false);
    expect(deepEqual({ a: 1, b: 2 }, { a: 1 })).toBe(false);
  });

  it("should compare mixed nested structures", () => {
    const obj1 = { users: [{ name: "John" }], count: 1 };
    const obj2 = { users: [{ name: "John" }], count: 1 };
    expect(deepEqual(obj1, obj2)).toBe(true);
  });
});

describe("checkJsonAssertions", () => {
  it("should pass when all assertions match", () => {
    const body = '{"data": {"user": {"name": "John", "age": 30}}}';
    const assertions = [
      { path: "data.user.name", expected: "John" },
      { path: "data.user.age", expected: 30 },
    ];
    const result = checkJsonAssertions(body, assertions);
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should fail when assertion does not match", () => {
    const body = '{"data": {"user": {"name": "Jane"}}}';
    const assertions = [{ path: "data.user.name", expected: "John" }];
    const result = checkJsonAssertions(body, assertions);
    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("JSONPath");
    expect(result.errors[0]).toContain("data.user.name");
  });

  it("should fail when JSON is invalid", () => {
    const body = "not valid json";
    const assertions = [{ path: "data", expected: "value" }];
    const result = checkJsonAssertions(body, assertions);
    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("Failed to parse response as JSON");
  });

  it("should handle multiple failing assertions", () => {
    const body = '{"a": 1, "b": 2}';
    const assertions = [
      { path: "a", expected: 100 },
      { path: "b", expected: 200 },
    ];
    const result = checkJsonAssertions(body, assertions);
    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(2);
  });

  it("should pass with empty assertions array", () => {
    const body = '{"data": "value"}';
    const result = checkJsonAssertions(body, []);
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
