/**
 * Retry helper for optimistic locking operations
 * Implements exponential backoff with jitter
 */
import { OptimisticLockError } from "./errors.js";

export interface RetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries: number;
  /** Base delay in milliseconds for exponential backoff (default: 50) */
  baseDelayMs: number;
  /** Maximum delay cap in milliseconds (default: 500) */
  maxDelayMs: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 50,
  maxDelayMs: 500,
};

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate backoff delay with jitter
 * Uses exponential backoff: baseDelay * 2^(attempt-1) + jitter
 */
function calculateBackoff(attempt: number, config: RetryConfig): number {
  const delay = config.baseDelayMs * Math.pow(2, attempt - 1);
  // Add ±10% jitter to prevent thundering herd
  const jitter = delay * 0.1 * (Math.random() * 2 - 1);
  return Math.min(delay + jitter, config.maxDelayMs);
}

/**
 * Execute an operation with retry on optimistic lock conflicts
 *
 * @param operation - The async operation to execute
 * @param config - Retry configuration
 * @returns The operation result
 * @throws OptimisticLockError if all retries exhausted
 * @throws Other errors immediately (non-retryable)
 *
 * @example
 * ```typescript
 * const result = await withOptimisticRetry(async () => {
 *   const index = await loadFeatureIndex(cwd);
 *   // modify index...
 *   await saveFeatureIndex(cwd, index);
 *   return index;
 * });
 * ```
 */
export async function withOptimisticRetry<T>(
  operation: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof OptimisticLockError) {
        lastError = error;
        if (attempt < config.maxRetries) {
          const delayMs = calculateBackoff(attempt, config);
          await sleep(delayMs);
          continue; // Retry
        }
      }
      // Non-retryable error or max retries reached
      throw error;
    }
  }

  // All retries exhausted (should only reach here if all attempts threw OptimisticLockError)
  throw lastError || new Error("All retry attempts failed");
}
