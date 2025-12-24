/**
 * AI prompt building for project scanning
 */

/**
 * Build autonomous exploration prompt for AI agent
 * The agent explores the project using its available tools
 */
export function buildAutonomousPrompt(projectPath: string): string {
  return `Perform a comprehensive survey of the software project located at: ${projectPath}

You are currently working in this directory. Explore it thoroughly using your available tools.

## Required Actions

1. **Explore structure**: List directories and files to understand the project layout
2. **Read configs**: Find and read configuration files (package.json, tsconfig.json, pyproject.toml, go.mod, Cargo.toml, etc.)
3. **Examine ALL source code**: Read EVERY source file to understand modules and features thoroughly
4. **Check tests**: Look for test files to understand what functionality exists
5. **Assess completeness**: Based on code quality and test coverage

## Feature Discovery Guidelines

IMPORTANT: Be extremely thorough when discovering features. Examine EVERY source file and extract ALL distinct capabilities. Look for:
- CLI commands and subcommands
- API endpoints (routes, handlers)
- ALL exported functions and classes (each is a feature)
- ALL internal utility functions with distinct functionality
- Database models and CRUD operations
- Configuration options and settings
- Plugin/extension points
- Event handlers and hooks
- Middleware and interceptors
- Type definitions and interfaces that represent domain concepts

Do NOT limit the number of features. Extract every distinct capability you find in the codebase.

## Output

Return ONLY a JSON object (no markdown, no explanation):

{
  "techStack": {
    "language": "primary language",
    "framework": "main framework or 'none'",
    "buildTool": "build tool",
    "testFramework": "test framework",
    "packageManager": "package manager"
  },
  "modules": [
    {
      "name": "module name",
      "path": "relative path",
      "description": "what this module does",
      "status": "complete|partial|stub"
    }
  ],
  "features": [
    {
      "id": "module.task.action",
      "description": "what this task does",
      "module": "parent module",
      "source": "route|test|code|config|inferred",
      "confidence": 0.8
    }
  ],
  "completion": {
    "overall": 0-100,
    "notes": ["observations"]
  },
  "commands": {
    "install": "install command",
    "dev": "dev command",
    "build": "build command",
    "test": "test command"
  },
  "summary": "2-3 sentences describing what this project is and does",
  "recommendations": ["improvement suggestions"]
}

Begin exploration now.`;
}

/**
 * Build prompt for generating features from existing survey
 */
export function buildSurveyPrompt(surveyContent: string, goal: string): string {
  return `You are an expert software architect. Based on the following project survey document and project goal, extract and generate a feature list.

## Project Goal
${goal}

## Project Survey Document
${surveyContent}

Based on this survey, respond with a JSON object (ONLY JSON, no markdown code blocks):

{
  "techStack": {
    "language": "from survey",
    "framework": "from survey",
    "buildTool": "from survey",
    "testFramework": "from survey",
    "packageManager": "from survey"
  },
  "modules": [
    {
      "name": "module name from survey",
      "path": "relative path",
      "description": "description",
      "status": "complete|partial|stub"
    }
  ],
  "features": [
    {
      "id": "hierarchical.task.id",
      "description": "what this task does",
      "module": "parent module name",
      "source": "survey",
      "confidence": 0.9
    }
  ],
  "completion": {
    "overall": 65,
    "notes": ["from survey"]
  },
  "commands": {
    "install": "from survey",
    "dev": "from survey",
    "build": "from survey",
    "test": "from survey"
  },
  "summary": "from survey",
  "recommendations": ["from survey"]
}

Extract all information directly from the survey document. Generate task IDs using hierarchical naming (module.submodule.action).`;
}

/**
 * Build prompt for generating features from goal description
 */
export function buildGoalPrompt(goal: string): string {
  return `You are an expert software architect. Based on the following project goal, generate an initial feature list for a brand new project.

## Project Goal
${goal}

Generate a comprehensive feature list for building this project from scratch. Think about:
1. Core functionality required to achieve the goal
2. Common supporting features (auth, config, error handling, etc. if relevant)
3. Developer experience features (CLI, API, etc. if relevant)
4. Testing and documentation needs

Respond with a JSON object (ONLY JSON, no markdown code blocks):

{
  "techStack": {
    "language": "recommended primary language",
    "framework": "recommended framework (or 'none')",
    "buildTool": "recommended build tool",
    "testFramework": "recommended test framework",
    "packageManager": "recommended package manager"
  },
  "modules": [
    {
      "name": "module name",
      "path": "suggested relative path",
      "description": "what this module handles",
      "status": "stub"
    }
  ],
  "features": [
    {
      "id": "hierarchical.task.id",
      "description": "what this task does - specific and testable",
      "module": "parent module name",
      "source": "goal",
      "confidence": 0.8
    }
  ],
  "completion": {
    "overall": 0,
    "notes": ["Project not yet started - features generated from goal"]
  },
  "commands": {
    "install": "suggested install command",
    "dev": "suggested dev command",
    "build": "suggested build command",
    "test": "suggested test command"
  },
  "summary": "Brief description of what will be built",
  "recommendations": [
    "Start with feature X first",
    "Consider Y for architecture"
  ]
}

Guidelines:
1. Generate 10-20 features that cover the full scope of the goal
2. Use hierarchical IDs: module.submodule.action (e.g., auth.user.login, api.orders.create)
3. Each feature should be specific enough to be implemented and tested independently
4. Order features by logical dependency (foundational features first)
5. All features start with status "failing" (will be set by the calling code)
6. Recommend a reasonable tech stack based on the goal (don't over-engineer)`;
}
