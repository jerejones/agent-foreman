/**
 * Survey conversion and markdown generation utilities
 */
import type {
  ProjectSurvey,
  TechStackInfo,
  DirectoryStructure,
  ProjectCommands,
} from "../types/index.js";
import type { AIAnalysisResult } from "./types.js";

/**
 * Convert AI analysis result to ProjectSurvey format
 */
export function aiResultToSurvey(
  result: AIAnalysisResult,
  structure: DirectoryStructure
): ProjectSurvey {
  const defaultTechStack: TechStackInfo = {
    language: "unknown",
    framework: "unknown",
    buildTool: "unknown",
    testFramework: "unknown",
    packageManager: "unknown",
  };

  const defaultCommands: ProjectCommands = {
    install: "",
    dev: "",
    build: "",
    test: "",
  };

  return {
    techStack: result.techStack || defaultTechStack,
    structure,
    modules: result.modules || [],
    features: result.features || [],
    completion: result.completion || { overall: 0, byModule: {}, notes: [] },
    commands: result.commands || defaultCommands,
  };
}

/**
 * Generate enhanced survey markdown with AI insights
 *
 * @param survey - Project survey data
 * @param aiResult - AI analysis results
 */
export function generateAISurveyMarkdown(
  survey: ProjectSurvey,
  aiResult: AIAnalysisResult
): string {
  const lines: string[] = [];

  // Title
  lines.push("# Project Survey (AI-Enhanced)\n");

  // Summary
  if (aiResult.summary) {
    lines.push("## Summary\n");
    lines.push(aiResult.summary);
    lines.push("");
  }

  if (aiResult.agentUsed) {
    lines.push(`> Analyzed by: ${aiResult.agentUsed}\n`);
  }

  // Tech Stack
  lines.push("## Tech Stack\n");
  lines.push("| Aspect | Value |");
  lines.push("|--------|-------|");
  lines.push(`| Language | ${survey.techStack.language} |`);
  lines.push(`| Framework | ${survey.techStack.framework} |`);
  lines.push(`| Build Tool | ${survey.techStack.buildTool} |`);
  lines.push(`| Test Framework | ${survey.techStack.testFramework} |`);
  lines.push(`| Package Manager | ${survey.techStack.packageManager} |`);
  lines.push("");

  // Directory Structure
  lines.push("## Directory Structure\n");

  if (survey.structure.entryPoints.length > 0) {
    lines.push("### Entry Points");
    for (const e of survey.structure.entryPoints) {
      lines.push(`- \`${e}\``);
    }
    lines.push("");
  }

  if (survey.structure.srcDirs.length > 0) {
    lines.push("### Source Directories");
    for (const d of survey.structure.srcDirs) {
      lines.push(`- \`${d}/\``);
    }
    lines.push("");
  }

  // Modules with descriptions
  if (survey.modules.length > 0) {
    lines.push("## Modules\n");
    for (const m of survey.modules) {
      lines.push(`### ${m.name}`);
      lines.push(`- **Path**: \`${m.path}\``);
      lines.push(`- **Status**: ${m.status}`);
      if (m.description) {
        lines.push(`- **Description**: ${m.description}`);
      }
      lines.push("");
    }
  }

  // Discovered Features
  if (survey.features.length > 0) {
    // Check if features have actual status (from feature index)
    const hasStatus = survey.features.some((f) => f.status);

    if (hasStatus) {
      lines.push("## Feature Completion Status\n");
      lines.push("| ID | Description | Module | Status |");
      lines.push("|----|-------------|--------|--------|");
      for (const f of survey.features.slice(0, 100)) {
        const statusIcon = f.status === "passing" ? "✅" : f.status === "failing" ? "❌" : "⏸️";
        lines.push(`| ${f.id} | ${f.description} | ${f.module} | ${statusIcon} ${f.status} |`);
      }
    } else {
      lines.push("## Discovered Features\n");
      lines.push("| ID | Description | Module | Source | Confidence |");
      lines.push("|----|-------------|--------|--------|------------|");
      for (const f of survey.features.slice(0, 100)) {
        const confidence = typeof f.confidence === "number" ? `${Math.round(f.confidence * 100)}%` : "-";
        lines.push(`| ${f.id} | ${f.description} | ${f.module} | ${f.source} | ${confidence} |`);
      }
    }
    if (survey.features.length > 100) {
      lines.push(`\n*... and ${survey.features.length - 100} more features*`);
    }
    lines.push("");
  }

  // Completion Assessment
  lines.push("## Completion Assessment\n");
  lines.push(`**Overall: ${survey.completion.overall}%**\n`);

  if (survey.completion.notes && survey.completion.notes.length > 0) {
    lines.push("**Notes:**");
    for (const note of survey.completion.notes) {
      lines.push(`- ${note}`);
    }
    lines.push("");
  }

  // Recommendations
  if (aiResult.recommendations && aiResult.recommendations.length > 0) {
    lines.push("## Recommendations\n");
    for (const rec of aiResult.recommendations) {
      lines.push(`- ${rec}`);
    }
    lines.push("");
  }

  // Commands
  lines.push("## Commands\n");
  lines.push("```bash");
  if (survey.commands.install) {
    lines.push(`# Install dependencies\n${survey.commands.install}\n`);
  }
  if (survey.commands.dev) {
    lines.push(`# Start development server\n${survey.commands.dev}\n`);
  }
  if (survey.commands.build) {
    lines.push(`# Build for production\n${survey.commands.build}\n`);
  }
  if (survey.commands.test) {
    lines.push(`# Run tests\n${survey.commands.test}`);
  }
  lines.push("```\n");

  lines.push("---\n");
  lines.push("*Generated by agent-foreman with AI analysis*");

  return lines.join("\n");
}
