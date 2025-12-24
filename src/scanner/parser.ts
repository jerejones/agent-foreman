/**
 * AI response parsing utilities
 */
import chalk from "chalk";
import type { AIAnalysisResult } from "./types.js";
import { validateDiscoveredFeatures } from "../validation/index.js";

/**
 * Parse AI response to extract analysis
 * Includes schema validation for AI-generated features
 */
export function parseAIResponse(response: string): AIAnalysisResult {
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

    // Validate AI-generated features
    let features = parsed.features || [];
    if (features.length > 0) {
      const validation = validateDiscoveredFeatures(features);

      // Log validation warnings
      if (validation.warnings.length > 0) {
        console.log(chalk.yellow(`  ⚠ ${validation.warnings.length} validation warning(s) in AI output:`));
        for (const warn of validation.warnings.slice(0, 3)) {
          console.log(chalk.gray(`    - [${warn.index}].${warn.field}: ${warn.message}`));
        }
        if (validation.warnings.length > 3) {
          console.log(chalk.gray(`    ... and ${validation.warnings.length - 3} more`));
        }
      }

      // Log validation errors
      if (validation.errors.length > 0) {
        console.log(chalk.red(`  ✗ ${validation.errors.length} validation error(s) in AI output:`));
        for (const err of validation.errors.slice(0, 5)) {
          console.log(chalk.red(`    - [${err.index}].${err.field}: ${err.message}`));
        }
        if (validation.errors.length > 5) {
          console.log(chalk.red(`    ... and ${validation.errors.length - 5} more`));
        }
      }

      // Use sanitized features if available, otherwise use original
      if (validation.sanitized && validation.sanitized.length > 0) {
        const sanitizedCount = validation.sanitized.length;
        const originalCount = features.length;
        if (sanitizedCount < originalCount) {
          console.log(chalk.yellow(`  ⚠ ${originalCount - sanitizedCount} feature(s) dropped due to validation errors`));
        }
        features = validation.sanitized;
        console.log(chalk.green(`  ✓ Validated ${features.length} feature(s)`));
      } else if (!validation.valid) {
        console.log(chalk.yellow(`  ⚠ Using unvalidated features (validation failed)`));
      }
    }

    return {
      success: true,
      techStack: parsed.techStack,
      modules: parsed.modules || [],
      features,
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
