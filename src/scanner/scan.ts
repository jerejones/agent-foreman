/**
 * AI-powered project scanning
 */
import chalk from "chalk";
import { callAnyAvailableAgent, getAvailableAgent } from "../agents.js";
import { getTimeout } from "../timeout-config.js";
import { isTTY } from "../progress.js";
import type { AIAnalysisResult, AIScanOptions } from "./types.js";
import { buildAutonomousPrompt } from "./prompts.js";
import { parseAIResponse } from "./parser.js";

/**
 * Perform AI-powered project scan using autonomous exploration
 *
 * The agent explores the project itself using its own tools,
 * rather than us collecting context and passing it to the agent.
 *
 * Priority order: Codex > Gemini > Claude
 */
export async function aiScanProject(
  basePath: string,
  options: AIScanOptions = {}
): Promise<AIAnalysisResult> {
  const { verbose = false } = options;

  // Check if any AI agent is available
  const agent = getAvailableAgent();

  if (!agent) {
    return {
      success: false,
      error: "No AI agents available. Install gemini, codex, or claude CLI.",
    };
  }

  let currentAgentName = agent.name;

  // Build autonomous exploration prompt
  console.log(chalk.gray("  [1/2] Preparing autonomous exploration..."));
  const prompt = buildAutonomousPrompt(basePath);

  if (verbose) {
    console.log(chalk.gray(`        Project path: ${basePath}`));
    console.log(chalk.gray(`        Using agent: ${currentAgentName}`));
  }

  // Launch agent with unified progress indicator
  const startTime = Date.now();
  const spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let spinnerIdx = 0;
  let spinnerInterval: NodeJS.Timeout | null = null;

  const renderSpinner = () => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    process.stdout.write(chalk.gray(`  [2/2] Exploring with ${currentAgentName}... ${chalk.cyan(spinnerFrames[spinnerIdx])} ${chalk.gray(`(${elapsed}s)`)}`));
    spinnerIdx = (spinnerIdx + 1) % spinnerFrames.length;
  };

  if (isTTY()) {
    process.stdout.write(chalk.gray(`  [2/2] Exploring with ${currentAgentName}...`));
    spinnerInterval = setInterval(renderSpinner, 100);
  } else {
    console.log(chalk.gray(`  [2/2] Exploring with ${currentAgentName}...`));
  }

  const result = await callAnyAvailableAgent(prompt, {
    verbose,
    cwd: basePath, // Run agent in project directory so it can explore
    timeoutMs: getTimeout("AI_SCAN_PROJECT"),
    showProgress: false,
    onAgentSelected: (name) => {
      currentAgentName = name;
      if (!isTTY()) {
        console.log(chalk.gray(`        Using ${name}...`));
      }
    },
  });

  if (spinnerInterval) {
    clearInterval(spinnerInterval);
  }
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  if (isTTY()) {
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
  }

  if (!result.success) {
    console.log(chalk.gray(`  [2/2] Exploring with ${currentAgentName}... ${chalk.red("✗")} ${chalk.gray(`(${elapsed}s)`)}`));
    return {
      success: false,
      error: result.error,
    };
  }

  console.log(chalk.gray(`  [2/2] Exploring with ${currentAgentName}... ${chalk.green("✓")} ${chalk.gray(`(${elapsed}s)`)}`));

  // Parse the exploration results
  process.stdout.write(chalk.gray("  [✓] Parsing exploration results..."));
  const analysis = parseAIResponse(result.output);
  console.log(chalk.green(" done"));

  if (analysis.success) {
    analysis.agentUsed = result.agentUsed;
  }

  return analysis;
}
