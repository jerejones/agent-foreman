/**
 * Feature generation functions using AI
 */
import { callAnyAvailableAgent } from "../agents.js";
import { getTimeout } from "../timeout-config.js";
import type { AIAnalysisResult } from "./types.js";
import { buildSurveyPrompt, buildGoalPrompt } from "./prompts.js";
import { parseAIResponse } from "./parser.js";
import { createSpinner } from "../ui/index.js";

/**
 * Generate features from existing ARCHITECTURE.md + goal
 * Much faster than full scan since it reuses existing survey
 */
export async function generateFeaturesFromSurvey(
  surveyContent: string,
  goal: string
): Promise<AIAnalysisResult> {
  const prompt = buildSurveyPrompt(surveyContent, goal);
  const spinner = createSpinner();
  const baseMessage = "Generating features from survey";

  spinner.start(`${baseMessage}...`);

  const result = await callAnyAvailableAgent(prompt, {
    verbose: true,
    timeoutMs: getTimeout("AI_GENERATE_FROM_ANALYZE"),
    showProgress: false,
    onAgentSelected: (name) => spinner.update(`${baseMessage}... (Using ${name})`),
  });

  if (!result.success) {
    spinner.fail("Feature generation failed");
    return {
      success: false,
      error: result.error,
    };
  }

  spinner.update("Parsing AI response...");
  const analysis = parseAIResponse(result.output);

  if (analysis.success) {
    analysis.agentUsed = result.agentUsed;
    const agentInfo = result.agentUsed ? ` (via ${result.agentUsed})` : "";
    spinner.succeed(`Generated ${analysis.features?.length ?? 0} features from survey${agentInfo}`);
  } else {
    spinner.fail("Failed to parse AI response");
  }

  return analysis;
}

/**
 * Generate features from goal description for new/empty projects
 * Used when there is no existing code to scan
 */
export async function generateFeaturesFromGoal(
  goal: string
): Promise<AIAnalysisResult> {
  const prompt = buildGoalPrompt(goal);
  const spinner = createSpinner();
  const baseMessage = "Generating features from goal description";

  spinner.start(`${baseMessage}...`);

  const result = await callAnyAvailableAgent(prompt, {
    verbose: true,
    timeoutMs: getTimeout("AI_GENERATE_FROM_GOAL"),
    showProgress: false,
    onAgentSelected: (name) => spinner.update(`${baseMessage}... (Using ${name})`),
  });

  if (!result.success) {
    spinner.fail("Feature generation failed");
    return {
      success: false,
      error: result.error,
    };
  }

  spinner.update("Parsing AI response...");
  const analysis = parseAIResponse(result.output);

  if (analysis.success) {
    analysis.agentUsed = result.agentUsed;
    const agentInfo = result.agentUsed ? ` (via ${result.agentUsed})` : "";
    spinner.succeed(`Generated ${analysis.features?.length ?? 0} features from goal${agentInfo}`);
  } else {
    spinner.fail("Failed to parse AI response");
  }

  return analysis;
}
