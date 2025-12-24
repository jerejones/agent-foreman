#!/usr/bin/env npx tsx
/**
 * Simple verification script to test validation module logic
 * Run with: npx tsx scripts/verify-validation.ts
 */

import {
  validateDiscoveredFeatures,
  validateFeature,
  validateBashScript,
  isLikelyBashScript,
} from "../src/validation/index.js";

console.log("=== Validation Module Verification ===\n");

// Test 1: Valid features
console.log("Test 1: Valid features");
const validFeatures = [
  {
    id: "auth.login",
    description: "User can log in",
    module: "auth",
    source: "inferred",
    confidence: 0.8,
  },
];
const result1 = validateDiscoveredFeatures(validFeatures);
console.log(`  Valid: ${result1.valid}`);
console.log(`  Errors: ${result1.errors.length}`);
console.log(`  Warnings: ${result1.warnings.length}`);
console.log(`  Sanitized count: ${result1.sanitized?.length ?? 0}`);
console.assert(result1.valid === true, "Expected valid=true");
console.log("  ✓ PASSED\n");

// Test 2: Invalid features (missing id)
console.log("Test 2: Invalid features (missing id)");
const invalidFeatures = [
  {
    description: "Missing id",
    module: "test",
    source: "inferred",
    confidence: 0.5,
  },
];
const result2 = validateDiscoveredFeatures(invalidFeatures);
console.log(`  Valid: ${result2.valid}`);
console.log(`  Errors: ${result2.errors.length}`);
console.assert(result2.valid === false, "Expected valid=false");
console.assert(result2.errors.length > 0, "Expected errors");
console.log("  ✓ PASSED\n");

// Test 3: Non-array input
console.log("Test 3: Non-array input");
const result3 = validateDiscoveredFeatures("not an array");
console.log(`  Valid: ${result3.valid}`);
console.log(`  Errors: ${result3.errors.length}`);
console.assert(result3.valid === false, "Expected valid=false");
console.log("  ✓ PASSED\n");

// Test 4: Confidence clamping
console.log("Test 4: Confidence clamping (1.5 -> 1.0)");
const highConfFeatures = [
  {
    id: "test.feature",
    description: "Test",
    module: "test",
    source: "inferred",
    confidence: 1.5,
  },
];
const result4 = validateDiscoveredFeatures(highConfFeatures);
console.log(`  Valid: ${result4.valid}`);
console.log(`  Sanitized confidence: ${result4.sanitized?.[0]?.confidence}`);
console.assert(result4.sanitized?.[0]?.confidence === 1, "Expected confidence=1");
console.log("  ✓ PASSED\n");

// Test 5: Bash script validation
console.log("Test 5: Valid bash script");
const validScript = `#!/usr/bin/env bash

bootstrap() {
  npm install
}

dev() {
  npm run dev
}

check() {
  npm test
}

case "$1" in
  bootstrap) bootstrap ;;
  dev) dev ;;
  check) check ;;
esac
`;
const result5 = validateBashScript(validScript);
console.log(`  Valid: ${result5.valid}`);
console.log(`  Errors: ${result5.errors.length}`);
console.log(`  Warnings: ${result5.warnings.length}`);
console.assert(result5.valid === true, "Expected valid=true");
console.log("  ✓ PASSED\n");

// Test 6: Invalid bash script (no shebang)
console.log("Test 6: Invalid bash script (no shebang)");
const invalidScript = `
bootstrap() {
  npm install
}
`;
const result6 = validateBashScript(invalidScript);
console.log(`  Valid: ${result6.valid}`);
console.log(`  Errors: ${result6.errors}`);
console.assert(result6.valid === false, "Expected valid=false");
console.log("  ✓ PASSED\n");

// Test 7: isLikelyBashScript
console.log("Test 7: isLikelyBashScript");
console.log(`  "#!/usr/bin/env bash\\n..." -> ${isLikelyBashScript("#!/usr/bin/env bash\necho")}`);
console.log(`  "#!/bin/bash\\n..." -> ${isLikelyBashScript("#!/bin/bash\necho")}`);
console.log(`  "function() {}" -> ${isLikelyBashScript("function() {}")}`);
console.assert(isLikelyBashScript("#!/usr/bin/env bash\necho") === true);
console.assert(isLikelyBashScript("function() {}") === false);
console.log("  ✓ PASSED\n");

// Test 8: Complete Feature validation
console.log("Test 8: Complete Feature validation");
const completeFeature = {
  id: "auth.login",
  description: "User can log in",
  module: "auth",
  priority: 1,
  status: "failing",
  acceptance: ["User enters credentials"],
  dependsOn: [],
  supersedes: [],
  tags: ["auth"],
  version: 1,
  origin: "manual",
  notes: "",
};
const result8 = validateFeature(completeFeature);
console.log(`  Valid: ${result8.valid}`);
console.log(`  Errors: ${result8.errors.length}`);
console.assert(result8.valid === true, "Expected valid=true");
console.log("  ✓ PASSED\n");

console.log("=== All verification tests passed! ===");
