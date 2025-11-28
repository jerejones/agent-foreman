/**
 * Tests for src/ai-scanner.ts - AI-powered project analysis
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { aiResultToSurvey, generateAISurveyMarkdown, type AIAnalysisResult } from "../src/ai-scanner.js";
import type { DirectoryStructure, ProjectSurvey } from "../src/types.js";

describe("AI Scanner", () => {
  describe("aiResultToSurvey", () => {
    const mockStructure: DirectoryStructure = {
      entryPoints: ["src/index.ts"],
      srcDirs: ["src"],
      testDirs: ["tests"],
      configFiles: ["tsconfig.json"],
    };

    it("should convert successful AI result to survey", () => {
      const aiResult: AIAnalysisResult = {
        success: true,
        techStack: {
          language: "typescript",
          framework: "express",
          buildTool: "tsc",
          testFramework: "vitest",
          packageManager: "npm",
        },
        modules: [
          { name: "auth", path: "src/auth", description: "Authentication", files: [], status: "partial" },
        ],
        features: [
          { id: "auth.login", description: "Login endpoint", module: "auth", source: "route", confidence: 0.9 },
        ],
        completion: { overall: 50, byModule: { auth: 50 }, notes: ["In progress"] },
        commands: { install: "npm install", dev: "npm run dev", build: "npm run build", test: "npm test" },
        summary: "Test project",
        recommendations: ["Add tests"],
        agentUsed: "gemini",
      };

      const survey = aiResultToSurvey(aiResult, mockStructure);

      expect(survey.techStack.language).toBe("typescript");
      expect(survey.techStack.framework).toBe("express");
      expect(survey.structure).toBe(mockStructure);
      expect(survey.modules).toHaveLength(1);
      expect(survey.features).toHaveLength(1);
      expect(survey.completion.overall).toBe(50);
    });

    it("should provide defaults for missing AI result data", () => {
      const aiResult: AIAnalysisResult = {
        success: true,
      };

      const survey = aiResultToSurvey(aiResult, mockStructure);

      expect(survey.techStack.language).toBe("unknown");
      expect(survey.techStack.framework).toBe("unknown");
      expect(survey.modules).toHaveLength(0);
      expect(survey.features).toHaveLength(0);
      expect(survey.completion.overall).toBe(0);
    });

    it("should preserve structure from scan", () => {
      const aiResult: AIAnalysisResult = {
        success: true,
        techStack: {
          language: "python",
          framework: "fastapi",
          buildTool: "pip",
          testFramework: "pytest",
          packageManager: "pip",
        },
      };

      const customStructure: DirectoryStructure = {
        entryPoints: ["main.py"],
        srcDirs: ["app"],
        testDirs: ["tests"],
        configFiles: ["pyproject.toml"],
      };

      const survey = aiResultToSurvey(aiResult, customStructure);

      expect(survey.structure.entryPoints).toContain("main.py");
      expect(survey.structure.srcDirs).toContain("app");
    });
  });

  describe("generateAISurveyMarkdown", () => {
    const mockSurvey: ProjectSurvey = {
      techStack: {
        language: "typescript",
        framework: "express",
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
      modules: [
        { name: "api", path: "src/api", description: "REST API", files: ["routes.ts"], status: "partial" },
      ],
      features: [
        { id: "api.users", description: "Users API", module: "api", source: "route", confidence: 0.8 },
      ],
      completion: { overall: 60, byModule: { api: 60 }, notes: ["Needs testing"] },
      commands: { install: "npm install", dev: "npm run dev", build: "npm run build", test: "npm test" },
    };

    it("should generate markdown with AI-Enhanced header", () => {
      const aiResult: AIAnalysisResult = {
        success: true,
        summary: "A TypeScript Express API",
        recommendations: ["Add tests", "Add documentation"],
        agentUsed: "gemini",
      };

      const markdown = generateAISurveyMarkdown(mockSurvey, aiResult);

      expect(markdown).toContain("# Project Survey (AI-Enhanced)");
      expect(markdown).toContain("Analyzed by: gemini");
    });

    it("should include summary when provided", () => {
      const aiResult: AIAnalysisResult = {
        success: true,
        summary: "This is a comprehensive Express API project",
        agentUsed: "claude",
      };

      const markdown = generateAISurveyMarkdown(mockSurvey, aiResult);

      expect(markdown).toContain("## Summary");
      expect(markdown).toContain("This is a comprehensive Express API project");
    });

    it("should include recommendations when provided", () => {
      const aiResult: AIAnalysisResult = {
        success: true,
        recommendations: ["Add unit tests", "Improve error handling", "Add CI/CD"],
        agentUsed: "codex",
      };

      const markdown = generateAISurveyMarkdown(mockSurvey, aiResult);

      expect(markdown).toContain("## Recommendations");
      expect(markdown).toContain("Add unit tests");
      expect(markdown).toContain("Improve error handling");
      expect(markdown).toContain("Add CI/CD");
    });

    it("should include tech stack table", () => {
      const aiResult: AIAnalysisResult = { success: true, agentUsed: "gemini" };
      const markdown = generateAISurveyMarkdown(mockSurvey, aiResult);

      expect(markdown).toContain("## Tech Stack");
      expect(markdown).toContain("typescript");
      expect(markdown).toContain("express");
      expect(markdown).toContain("vitest");
    });

    it("should include modules with descriptions", () => {
      const surveyWithModules: ProjectSurvey = {
        ...mockSurvey,
        modules: [
          { name: "auth", path: "src/auth", description: "Authentication module", files: [], status: "complete" },
          { name: "users", path: "src/users", description: "User management", files: [], status: "partial" },
        ],
      };
      const aiResult: AIAnalysisResult = { success: true, agentUsed: "gemini" };

      const markdown = generateAISurveyMarkdown(surveyWithModules, aiResult);

      expect(markdown).toContain("## Modules");
      expect(markdown).toContain("### auth");
      expect(markdown).toContain("Authentication module");
      expect(markdown).toContain("### users");
      expect(markdown).toContain("User management");
    });

    it("should include discovered features table", () => {
      const aiResult: AIAnalysisResult = { success: true, agentUsed: "gemini" };
      const markdown = generateAISurveyMarkdown(mockSurvey, aiResult);

      expect(markdown).toContain("## Discovered Features");
      expect(markdown).toContain("| ID | Description | Module | Source | Confidence |");
      expect(markdown).toContain("api.users");
    });

    it("should include completion assessment", () => {
      const aiResult: AIAnalysisResult = { success: true, agentUsed: "gemini" };
      const markdown = generateAISurveyMarkdown(mockSurvey, aiResult);

      expect(markdown).toContain("## Completion Assessment");
      expect(markdown).toContain("**Overall: 60%**");
    });

    it("should include commands section", () => {
      const aiResult: AIAnalysisResult = { success: true, agentUsed: "gemini" };
      const markdown = generateAISurveyMarkdown(mockSurvey, aiResult);

      expect(markdown).toContain("## Commands");
      expect(markdown).toContain("npm install");
      expect(markdown).toContain("npm run dev");
    });

    it("should handle empty recommendations gracefully", () => {
      const aiResult: AIAnalysisResult = {
        success: true,
        recommendations: [],
        agentUsed: "gemini",
      };

      const markdown = generateAISurveyMarkdown(mockSurvey, aiResult);

      // Should not crash, and should not include empty recommendations section
      expect(markdown).not.toContain("## Recommendations\n\n##");
    });

    it("should limit features to 100 for readability", () => {
      const manyFeatures = [];
      for (let i = 0; i < 150; i++) {
        manyFeatures.push({
          id: `feature.${i}`,
          description: `Feature ${i}`,
          module: "test",
          source: "route" as const,
          confidence: 0.8,
        });
      }

      const surveyWithManyFeatures: ProjectSurvey = {
        ...mockSurvey,
        features: manyFeatures,
      };

      const aiResult: AIAnalysisResult = { success: true, agentUsed: "gemini" };
      const markdown = generateAISurveyMarkdown(surveyWithManyFeatures, aiResult);

      expect(markdown).toContain("and 50 more features");
    });
  });
});
