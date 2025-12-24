/**
 * Criterion result types
 */

/**
 * Result of evaluating a single acceptance criterion
 */
export interface CriterionResult {
  /** The acceptance criterion text */
  criterion: string;
  /** Index in the acceptance criteria array (0-based) */
  index: number;
  /** Whether this criterion is satisfied */
  satisfied: boolean;
  /** AI's reasoning for the verdict */
  reasoning: string;
  /** Evidence from code/diff (file:line references) */
  evidence?: string[];
  /** Confidence level (0-1, where 1 is highest confidence) */
  confidence: number;
}
