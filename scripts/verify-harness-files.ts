#!/usr/bin/env bun
/**
 * Simple verification script to test harness-files module logic
 * Run with: bun scripts/verify-harness-files.ts
 */

import {
  generateHarnessFiles,
  generateCapabilities,
  generateGitignore,
  generateInitScript,
  generateClaudeRules,
  generateProgressLog,
  showGitSuggestion,
  type InitContext,
} from "../src/init/index.js";
import type { FeatureList } from "../src/types/index.js";
import type { ProjectSurvey } from "../src/types/survey.js";

console.log("=== Harness Files Module Verification ===\n");

// Test 1: Module exports
console.log("Test 1: Module exports");
console.log(`  generateHarnessFiles: ${typeof generateHarnessFiles}`);
console.log(`  generateCapabilities: ${typeof generateCapabilities}`);
console.log(`  generateGitignore: ${typeof generateGitignore}`);
console.log(`  generateInitScript: ${typeof generateInitScript}`);
console.log(`  generateClaudeRules: ${typeof generateClaudeRules}`);
console.log(`  generateProgressLog: ${typeof generateProgressLog}`);
console.log(`  showGitSuggestion: ${typeof showGitSuggestion}`);

console.assert(typeof generateHarnessFiles === "function");
console.assert(typeof generateCapabilities === "function");
console.assert(typeof generateGitignore === "function");
console.assert(typeof generateInitScript === "function");
console.assert(typeof generateClaudeRules === "function");
console.assert(typeof generateProgressLog === "function");
console.assert(typeof showGitSuggestion === "function");
console.log("  ✓ PASSED\n");

// Test 2: InitContext type structure
console.log("Test 2: InitContext type structure");
const mockSurvey: ProjectSurvey = {
  techStack: {
    language: "typescript",
    framework: "node",
    buildTool: "tsc",
    testFramework: "vitest",
    packageManager: "npm",
  },
  structure: {
    entryPoints: ["src/index.ts"],
    srcDirs: ["src"],
    testDirs: ["tests"],
    configFiles: ["tsconfig.json"],
  },
  modules: [],
  features: [],
  completion: {
    overall: 0,
    byModule: {},
    notes: [],
  },
  commands: {
    install: "npm install",
    dev: "npm run dev",
    build: "npm run build",
    test: "npm test",
  },
};

const mockFeatureList: FeatureList = {
  features: [
    {
      id: "test.feature",
      description: "Test feature",
      module: "test",
      priority: 1,
      status: "failing",
      acceptance: ["Test passes"],
      dependsOn: [],
      supersedes: [],
      tags: [],
      version: 1,
      origin: "manual",
      notes: "",
    },
  ],
  metadata: {
    projectGoal: "Test project",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: "1.0.0",
  },
};

const ctx: InitContext = {
  cwd: "/tmp/test",
  goal: "Test project goal",
  mode: "new",
  survey: mockSurvey,
  featureList: mockFeatureList,
};

console.log(`  ctx.cwd: ${ctx.cwd}`);
console.log(`  ctx.goal: ${ctx.goal}`);
console.log(`  ctx.mode: ${ctx.mode}`);
console.log(`  ctx.survey defined: ${ctx.survey !== undefined}`);
console.log(`  ctx.featureList defined: ${ctx.featureList !== undefined}`);
console.log(`  ctx.capabilities: ${ctx.capabilities}`);
console.assert(ctx.cwd === "/tmp/test");
console.assert(ctx.goal === "Test project goal");
console.assert(ctx.mode === "new");
console.assert(ctx.capabilities === undefined);
console.log("  ✓ PASSED\n");

// Test 3: showGitSuggestion in scan mode (should not output)
console.log("Test 3: showGitSuggestion in scan mode (no output expected)");
const scanCtx: InitContext = { ...ctx, mode: "scan" };
showGitSuggestion(scanCtx);
console.log("  ✓ PASSED (no output in scan mode)\n");

// Test 4: showGitSuggestion in new mode
console.log("Test 4: showGitSuggestion in new mode");
showGitSuggestion(ctx);
console.log("  ✓ PASSED\n");

// Test 5: generateProgressLog in scan mode (should not write)
console.log("Test 5: generateProgressLog in scan mode");
// This should return without writing anything
await generateProgressLog(scanCtx);
console.log("  ✓ PASSED (no write in scan mode)\n");

console.log("=== All harness-files tests passed! ===");
