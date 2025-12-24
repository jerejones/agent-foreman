/**
 * Tests for validation module
 */
import { describe, it, expect } from "vitest";
import {
  validateDiscoveredFeatures,
  validateFeature,
  validateBashScript,
  isLikelyBashScript,
} from "../src/validation/index.js";

describe("validateDiscoveredFeatures", () => {
  it("should validate a valid feature array", () => {
    const features = [
      {
        id: "auth.login",
        description: "User can log in",
        module: "auth",
        source: "inferred",
        confidence: 0.8,
      },
      {
        id: "auth.logout",
        description: "User can log out",
        module: "auth",
        source: "route",
        confidence: 0.9,
      },
    ];

    const result = validateDiscoveredFeatures(features);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.sanitized).toHaveLength(2);
  });

  it("should return error for non-array input", () => {
    const result = validateDiscoveredFeatures("not an array");

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toBe("Features must be an array");
  });

  it("should return error for missing required fields", () => {
    const features = [
      {
        description: "Missing id and module",
        source: "inferred",
        confidence: 0.5,
      },
    ];

    const result = validateDiscoveredFeatures(features);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "id")).toBe(true);
  });

  it("should sanitize invalid confidence values", () => {
    const features = [
      {
        id: "test.feature",
        description: "Test feature",
        module: "test",
        source: "inferred",
        confidence: 1.5, // Invalid - should be clamped to 1
      },
    ];

    const result = validateDiscoveredFeatures(features);

    expect(result.valid).toBe(true);
    expect(result.sanitized?.[0].confidence).toBe(1);
    expect(result.warnings.some((w) => w.field === "confidence")).toBe(true);
  });

  it("should default source to inferred if invalid", () => {
    const features = [
      {
        id: "test.feature",
        description: "Test feature",
        module: "test",
        source: "invalid_source",
        confidence: 0.5,
      },
    ];

    const result = validateDiscoveredFeatures(features);

    expect(result.valid).toBe(true);
    expect(result.sanitized?.[0].source).toBe("inferred");
    expect(result.warnings.some((w) => w.field === "source")).toBe(true);
  });

  it("should warn about non-standard id format", () => {
    const features = [
      {
        id: "WeirdIdFormat",
        description: "Test feature",
        module: "test",
        source: "inferred",
        confidence: 0.5,
      },
    ];

    const result = validateDiscoveredFeatures(features);

    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.field === "id")).toBe(true);
  });

  it("should warn about duplicate ids", () => {
    const features = [
      {
        id: "auth.login",
        description: "First login feature",
        module: "auth",
        source: "inferred",
        confidence: 0.8,
      },
      {
        id: "auth.login",
        description: "Duplicate login feature",
        module: "auth",
        source: "inferred",
        confidence: 0.7,
      },
    ];

    const result = validateDiscoveredFeatures(features);

    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.message.includes("Duplicate"))).toBe(true);
  });

  it("should infer module from id if missing", () => {
    const features = [
      {
        id: "auth.login",
        description: "Test feature",
        source: "inferred",
        confidence: 0.5,
      },
    ];

    const result = validateDiscoveredFeatures(features);

    expect(result.valid).toBe(true);
    expect(result.sanitized?.[0].module).toBe("auth");
    expect(result.warnings.some((w) => w.field === "module")).toBe(true);
  });
});

describe("validateFeature", () => {
  it("should validate a complete feature object", () => {
    const feature = {
      id: "auth.login",
      description: "User can log in",
      module: "auth",
      priority: 1,
      status: "failing",
      acceptance: ["User enters credentials", "User is logged in"],
      dependsOn: [],
      supersedes: [],
      tags: ["auth"],
      version: 1,
      origin: "manual",
      notes: "",
    };

    const result = validateFeature(feature);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should reject invalid status", () => {
    const feature = {
      id: "test",
      description: "Test",
      module: "test",
      priority: 1,
      status: "invalid_status",
      acceptance: [],
      dependsOn: [],
      supersedes: [],
      tags: [],
      version: 1,
      origin: "manual",
      notes: "",
    };

    const result = validateFeature(feature);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("status"))).toBe(true);
  });

  it("should reject negative priority", () => {
    const feature = {
      id: "test",
      description: "Test",
      module: "test",
      priority: -1,
      status: "failing",
      acceptance: [],
      dependsOn: [],
      supersedes: [],
      tags: [],
      version: 1,
      origin: "manual",
      notes: "",
    };

    const result = validateFeature(feature);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("priority"))).toBe(true);
  });

  it("should accept priority of 0", () => {
    const feature = {
      id: "test",
      description: "Test",
      module: "test",
      priority: 0,
      status: "failing",
      acceptance: [],
      dependsOn: [],
      supersedes: [],
      tags: [],
      version: 1,
      origin: "manual",
      notes: "",
    };

    const result = validateFeature(feature);

    expect(result.valid).toBe(true);
  });

  it("should reject non-object input", () => {
    const result = validateFeature(null);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Feature must be an object");
  });
});

describe("validateBashScript", () => {
  it("should validate a valid bash script", () => {
    const script = `#!/usr/bin/env bash

set -e

bootstrap() {
  npm install
}

dev() {
  npm run dev
}

check() {
  npm test
}

show_help() {
  echo "Usage: ./init.sh [command]"
}

case "$1" in
  bootstrap) bootstrap ;;
  dev) dev ;;
  check) check ;;
  *) show_help ;;
esac
`;

    const result = validateBashScript(script);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should reject script without shebang", () => {
    const script = `
bootstrap() {
  npm install
}
`;

    const result = validateBashScript(script);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("shebang"))).toBe(true);
  });

  it("should detect unbalanced braces", () => {
    const script = `#!/usr/bin/env bash

bootstrap() {
  npm install
  if [ -f package.json ]; then
    echo "found"
  # Missing closing brace for function
`;

    const result = validateBashScript(script);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("brace"))).toBe(true);
  });

  it("should detect unbalanced case/esac", () => {
    const script = `#!/usr/bin/env bash

case "$1" in
  test) echo "test" ;;
# Missing esac
`;

    const result = validateBashScript(script);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("case/esac"))).toBe(true);
  });

  it("should detect unbalanced if/fi", () => {
    const script = `#!/usr/bin/env bash

if [ -f package.json ]; then
  echo "found"
# Missing fi
`;

    const result = validateBashScript(script);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("if/fi"))).toBe(true);
  });

  it("should warn about missing expected functions", () => {
    const script = `#!/usr/bin/env bash

# Minimal script without expected functions
echo "Hello"
`;

    const result = validateBashScript(script);

    expect(result.warnings.some((w) => w.includes("bootstrap"))).toBe(true);
    expect(result.warnings.some((w) => w.includes("dev"))).toBe(true);
    expect(result.warnings.some((w) => w.includes("check"))).toBe(true);
  });

  it("should warn about missing case statement", () => {
    const script = `#!/usr/bin/env bash

bootstrap() {
  npm install
}

dev() {
  npm run dev
}

check() {
  npm test
}
`;

    const result = validateBashScript(script);

    expect(result.warnings.some((w) => w.includes("case statement"))).toBe(true);
  });
});

describe("isLikelyBashScript", () => {
  it("should return true for bash shebang", () => {
    expect(isLikelyBashScript("#!/usr/bin/env bash\necho hello")).toBe(true);
  });

  it("should return true for /bin/bash shebang", () => {
    expect(isLikelyBashScript("#!/bin/bash\necho hello")).toBe(true);
  });

  it("should return true for /bin/sh shebang", () => {
    expect(isLikelyBashScript("#!/bin/sh\necho hello")).toBe(true);
  });

  it("should return false for non-bash content", () => {
    expect(isLikelyBashScript("function hello() { return 1; }")).toBe(false);
  });

  it("should return false for empty content", () => {
    expect(isLikelyBashScript("")).toBe(false);
  });

  it("should handle leading whitespace", () => {
    expect(isLikelyBashScript("  #!/usr/bin/env bash\necho hello")).toBe(false);
  });
});
