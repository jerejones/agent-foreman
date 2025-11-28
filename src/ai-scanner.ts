/**
 * AI-powered project scanner
 * Uses Claude/Gemini to intelligently analyze codebases
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { glob } from "glob";
import chalk from "chalk";
import { callAnyAvailableAgent, checkAvailableAgents } from "./agents.js";
import type {
  ProjectSurvey,
  TechStackInfo,
  DirectoryStructure,
  ModuleInfo,
  DiscoveredFeature,
  CompletionAssessment,
  ProjectCommands,
} from "./types.js";

/**
 * AI analysis result
 */
export interface AIAnalysisResult {
  success: boolean;
  techStack?: TechStackInfo;
  modules?: ModuleInfo[];
  features?: DiscoveredFeature[];
  completion?: CompletionAssessment;
  commands?: ProjectCommands;
  summary?: string;
  recommendations?: string[];
  error?: string;
  agentUsed?: string;
}

/**
 * Options for AI scanning
 */
export interface AIScanOptions {
  verbose?: boolean;
  maxFiles?: number;
  includeFileContents?: boolean;
}

/**
 * Collect project context for AI analysis
 * Language-agnostic: scans any project type
 */
async function collectProjectContext(
  basePath: string,
  options: AIScanOptions = {}
): Promise<string> {
  const { maxFiles = 100, includeFileContents = true } = options;
  const context: string[] = [];

  // 1. List directory structure (deeper scan)
  context.push("## Project Directory Structure\n");
  const tree = await getDirectoryTree(basePath, 4);
  context.push("```");
  context.push(tree);
  context.push("```\n");

  // 2. Find and read ALL config/manifest files (language-agnostic)
  const configPatterns = [
    // Universal
    "README*", "LICENSE*", "Makefile", "Dockerfile", "docker-compose*.yml",
    ".env.example", "*.toml", "*.yaml", "*.yml",
    // JavaScript/TypeScript
    "package.json", "tsconfig*.json", "*.config.{js,ts,mjs,cjs}",
    // Python
    "pyproject.toml", "setup.py", "setup.cfg", "requirements*.txt", "Pipfile",
    // Go
    "go.mod", "go.sum",
    // Rust
    "Cargo.toml", "Cargo.lock",
    // Java/Kotlin
    "pom.xml", "build.gradle*", "settings.gradle*",
    // Ruby
    "Gemfile", "Rakefile", "*.gemspec",
    // PHP
    "composer.json",
    // .NET
    "*.csproj", "*.sln", "*.fsproj",
    // Swift
    "Package.swift", "*.xcodeproj",
    // Elixir
    "mix.exs",
    // Scala
    "build.sbt",
  ];

  const foundConfigs: string[] = [];
  for (const pattern of configPatterns) {
    const matches = await glob(pattern, { cwd: basePath, nodir: true });
    foundConfigs.push(...matches);
  }

  // Read config files
  for (const configFile of [...new Set(foundConfigs)].slice(0, 20)) {
    try {
      const content = await fs.readFile(path.join(basePath, configFile), "utf-8");
      const ext = path.extname(configFile).slice(1) || "text";
      context.push(`## ${configFile}\n`);
      context.push(`\`\`\`${ext}`);
      context.push(content.substring(0, 3000));
      if (content.length > 3000) context.push("\n... (truncated)");
      context.push("```\n");
    } catch {
      // Skip unreadable files
    }
  }

  // 3. Find and read source files (language-agnostic)
  if (includeFileContents) {
    // Common source file extensions for all languages
    const sourceExtensions = "{ts,tsx,js,jsx,mjs,cjs,py,go,rs,java,kt,rb,php,cs,fs,swift,scala,ex,exs,clj,c,cpp,h,hpp,lua,dart,vue,svelte,astro,md,mdx}";

    const sourcePatterns = [
      // Entry points and main files
      `**/main.${sourceExtensions}`,
      `**/index.${sourceExtensions}`,
      `**/app.${sourceExtensions}`,
      `**/server.${sourceExtensions}`,
      `**/mod.rs`, // Rust modules
      `**/lib.rs`, // Rust library
      // Source directories
      `**/src/**/*.${sourceExtensions}`,
      `**/lib/**/*.${sourceExtensions}`,
      `**/app/**/*.${sourceExtensions}`,
      `**/pkg/**/*.${sourceExtensions}`,
      `**/internal/**/*.${sourceExtensions}`,
      // API/Routes
      `**/api/**/*.${sourceExtensions}`,
      `**/routes/**/*.${sourceExtensions}`,
      `**/controllers/**/*.${sourceExtensions}`,
      `**/handlers/**/*.${sourceExtensions}`,
      `**/views/**/*.${sourceExtensions}`,
      `**/pages/**/*.${sourceExtensions}`,
      `**/components/**/*.${sourceExtensions}`,
    ];

    const ignorePatterns = [
      "node_modules/**", "dist/**", "build/**", "out/**", "target/**",
      ".git/**", "vendor/**", "__pycache__/**", ".next/**", ".nuxt/**",
      "*.min.js", "*.bundle.js", "coverage/**", ".cache/**",
    ];

    const sourceFiles: string[] = [];
    for (const pattern of sourcePatterns) {
      const matches = await glob(pattern, { cwd: basePath, ignore: ignorePatterns });
      sourceFiles.push(...matches);
    }

    // Sort by importance (shorter paths first, main/index first)
    const sortedFiles = [...new Set(sourceFiles)].sort((a, b) => {
      const aIsMain = /\/(main|index|app|server)\.[^/]+$/.test(a);
      const bIsMain = /\/(main|index|app|server)\.[^/]+$/.test(b);
      if (aIsMain && !bIsMain) return -1;
      if (!aIsMain && bIsMain) return 1;
      return a.split("/").length - b.split("/").length;
    });

    const filesToRead = sortedFiles.slice(0, maxFiles);

    if (filesToRead.length > 0) {
      context.push(`## Source Files (${filesToRead.length} of ${sortedFiles.length})\n`);

      for (const file of filesToRead) {
        try {
          const content = await fs.readFile(path.join(basePath, file), "utf-8");
          const ext = path.extname(file).slice(1) || "text";
          context.push(`### ${file}\n`);
          context.push(`\`\`\`${ext}`);
          context.push(content.substring(0, 4000));
          if (content.length > 4000) context.push("\n// ... (truncated)");
          context.push("```\n");
        } catch {
          // Skip unreadable files
        }
      }
    }
  }

  // 4. Find test files (language-agnostic patterns)
  const testPatterns = [
    "**/*.test.*", "**/*.spec.*", "**/*_test.*", "**/test_*.*",
    "**/tests/**/*.*", "**/test/**/*.*", "**/__tests__/**/*.*",
    "**/spec/**/*.*", "**/specs/**/*.*",
  ];

  const testFiles: string[] = [];
  for (const pattern of testPatterns) {
    const matches = await glob(pattern, {
      cwd: basePath,
      ignore: ["node_modules/**", "dist/**", ".git/**", "vendor/**"],
    });
    testFiles.push(...matches);
  }

  if (testFiles.length > 0) {
    context.push(`## Test Files (${testFiles.length} found)\n`);
    context.push("```");
    testFiles.slice(0, 30).forEach((f) => context.push(f));
    if (testFiles.length > 30) context.push(`... and ${testFiles.length - 30} more`);
    context.push("```\n");
  }

  return context.join("\n");
}

/**
 * Get directory tree as string
 */
async function getDirectoryTree(basePath: string, maxDepth: number): Promise<string> {
  const lines: string[] = [];
  const ignore = ["node_modules", "dist", "build", ".git", "vendor", "__pycache__", ".next", ".nuxt"];

  async function walk(dir: string, prefix: string, depth: number): Promise<void> {
    if (depth > maxDepth) return;

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const filtered = entries.filter((e) => !ignore.includes(e.name) && !e.name.startsWith("."));

      for (let i = 0; i < filtered.length; i++) {
        const entry = filtered[i];
        const isLast = i === filtered.length - 1;
        const connector = isLast ? "└── " : "├── ";
        const newPrefix = isLast ? "    " : "│   ";

        if (entry.isDirectory()) {
          lines.push(`${prefix}${connector}${entry.name}/`);
          await walk(path.join(dir, entry.name), prefix + newPrefix, depth + 1);
        } else {
          lines.push(`${prefix}${connector}${entry.name}`);
        }
      }
    } catch {
      // Skip inaccessible directories
    }
  }

  lines.push(path.basename(basePath) + "/");
  await walk(basePath, "", 0);
  return lines.join("\n");
}

/**
 * Build prompt for AI analysis
 * Language-agnostic: works with any programming language or framework
 */
function buildAnalysisPrompt(projectContext: string): string {
  return `You are an expert software architect. Analyze the following codebase and provide a comprehensive project survey.

${projectContext}

Based on your analysis, respond with a JSON object (ONLY JSON, no markdown code blocks):

{
  "techStack": {
    "language": "primary programming language(s) used",
    "framework": "main framework or library (if any)",
    "buildTool": "build/compile tool",
    "testFramework": "testing framework",
    "packageManager": "dependency manager"
  },
  "modules": [
    {
      "name": "module/component name",
      "path": "relative path",
      "description": "clear description of purpose and responsibility",
      "status": "complete|partial|stub"
    }
  ],
  "features": [
    {
      "id": "hierarchical.feature.id",
      "description": "what this feature does",
      "module": "parent module name",
      "source": "route|test|controller|model|inferred|config",
      "confidence": 0.8
    }
  ],
  "completion": {
    "overall": 65,
    "notes": ["key observations about project completeness"]
  },
  "commands": {
    "install": "command to install all dependencies",
    "dev": "command to run in development mode",
    "build": "command to build/compile for production",
    "test": "command to run tests"
  },
  "summary": "2-3 sentence executive summary describing what this project does and its current state",
  "recommendations": [
    "actionable improvement suggestion 1",
    "actionable improvement suggestion 2"
  ]
}

Analysis guidelines:
1. Identify ALL modules/components based on directory structure and code organization
2. Extract features from: API endpoints, CLI commands, test cases, exported functions, class methods
3. Use hierarchical IDs: module.submodule.action (e.g., auth.user.login, api.orders.create)
4. Assess completion realistically based on code implementation, not just file existence
5. Detect the tech stack automatically from config files and code patterns
6. Provide specific, actionable recommendations for next steps
7. If commands are unclear, infer from common patterns for the detected language/framework`;
}

/**
 * Parse AI response to extract analysis
 */
function parseAIResponse(response: string): AIAnalysisResult {
  try {
    // Try to extract JSON from the response
    let jsonStr = response.trim();

    // Remove markdown code blocks if present
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    // Try to find JSON object
    const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      jsonStr = objectMatch[0];
    }

    const parsed = JSON.parse(jsonStr);

    return {
      success: true,
      techStack: parsed.techStack,
      modules: parsed.modules || [],
      features: parsed.features || [],
      completion: parsed.completion,
      commands: parsed.commands,
      summary: parsed.summary,
      recommendations: parsed.recommendations || [],
    };
  } catch (err) {
    return {
      success: false,
      error: `Failed to parse AI response: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Perform AI-powered project scan
 * Priority order: Gemini > Codex > Claude
 * No timeout by default - let the AI agent complete
 */
export async function aiScanProject(
  basePath: string,
  options: AIScanOptions = {}
): Promise<AIAnalysisResult> {
  const { verbose = false } = options;

  // Check if any AI agent is available
  const agents = checkAvailableAgents();
  const hasAgent = agents.some((a) => a.available);

  if (!hasAgent) {
    return {
      success: false,
      error: "No AI agents available. Install gemini, codex, or claude CLI.",
    };
  }

  // Progress: Step 1 - Collecting context
  process.stdout.write(chalk.gray("  [1/3] Collecting project context..."));
  const startCollect = Date.now();

  // Collect project context
  const projectContext = await collectProjectContext(basePath, options);

  const collectTime = ((Date.now() - startCollect) / 1000).toFixed(1);
  console.log(chalk.green(` done (${collectTime}s)`));

  if (verbose) {
    console.log(chalk.gray(`        Context size: ${(projectContext.length / 1024).toFixed(1)}KB`));
  }

  // Progress: Step 2 - Building prompt
  process.stdout.write(chalk.gray("  [2/3] Building analysis prompt..."));
  const prompt = buildAnalysisPrompt(projectContext);
  console.log(chalk.green(" done"));

  if (verbose) {
    console.log(chalk.gray(`        Prompt size: ${(prompt.length / 1024).toFixed(1)}KB`));
  }

  // Progress: Step 3 - AI Analysis
  console.log(chalk.gray("  [3/3] Waiting for AI analysis..."));

  const result = await callAnyAvailableAgent(prompt, {
    preferredOrder: ["gemini", "codex", "claude"], // Priority: Gemini > Codex > Claude
    verbose: true, // Always show which agent is being used
  });

  if (!result.success) {
    return {
      success: false,
      error: result.error,
    };
  }

  // Progress: Parsing response
  process.stdout.write(chalk.gray("  [✓] Parsing AI response..."));
  const analysis = parseAIResponse(result.output);
  console.log(chalk.green(" done"));

  if (analysis.success) {
    analysis.agentUsed = result.agentUsed;
  }

  return analysis;
}

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
 */
export function generateAISurveyMarkdown(
  survey: ProjectSurvey,
  aiResult: AIAnalysisResult
): string {
  const lines: string[] = [];

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
    lines.push("## Discovered Features\n");
    lines.push("| ID | Description | Module | Source | Confidence |");
    lines.push("|----|-------------|--------|--------|------------|");
    for (const f of survey.features.slice(0, 100)) {
      const confidence = typeof f.confidence === "number" ? `${Math.round(f.confidence * 100)}%` : "-";
      lines.push(`| ${f.id} | ${f.description} | ${f.module} | ${f.source} | ${confidence} |`);
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
  if (survey.commands.install) lines.push(`# Install dependencies\n${survey.commands.install}\n`);
  if (survey.commands.dev) lines.push(`# Start development server\n${survey.commands.dev}\n`);
  if (survey.commands.build) lines.push(`# Build for production\n${survey.commands.build}\n`);
  if (survey.commands.test) lines.push(`# Run tests\n${survey.commands.test}`);
  lines.push("```\n");

  lines.push("---\n");
  lines.push("*Generated by agent-foreman with AI analysis*");

  return lines.join("\n");
}
