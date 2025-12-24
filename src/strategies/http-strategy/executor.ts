/**
 * HTTP Strategy Executor
 * Main executor class for HTTP verification strategy
 */

import type { Feature } from "../../types/index.js";
import type { HttpVerificationStrategy } from "../../verifier/types/index.js";
import type { StrategyExecutor, StrategyResult } from "../../strategy-executor.js";

import { DEFAULT_TIMEOUT } from "./constants.js";
import { substituteEnvVars, validateUrl } from "./url-validator.js";
import { checkStatusMatch, checkJsonAssertions } from "./assertions.js";
import { formatOutput } from "./output.js";

/**
 * HTTP Strategy Executor
 * Makes HTTP requests to verify endpoint availability and response
 */
export class HttpStrategyExecutor implements StrategyExecutor<HttpVerificationStrategy> {
  readonly type = "http" as const;

  /**
   * Execute HTTP verification strategy
   *
   * @param cwd - Current working directory
   * @param strategy - The HTTP strategy configuration
   * @param feature - The feature being verified
   * @returns Strategy execution result
   */
  async execute(
    cwd: string,
    strategy: HttpVerificationStrategy,
    feature: Feature
  ): Promise<StrategyResult> {
    const startTime = Date.now();
    const timeout = strategy.timeout ?? DEFAULT_TIMEOUT;

    try {
      // Substitute environment variables in URL
      const url = substituteEnvVars(strategy.url, strategy.env);

      // Validate URL for SSRF prevention
      const ssrfValidation = validateUrl(url, strategy.allowedHosts);
      if (!ssrfValidation.valid) {
        return {
          success: false,
          output: ssrfValidation.error ?? "URL validation failed",
          duration: Date.now() - startTime,
          details: { reason: "ssrf-blocked", url },
        };
      }

      // Prepare request options
      const method = strategy.method ?? "GET";
      const headers: Record<string, string> = {
        "User-Agent": "agent-foreman-http-verifier/1.0",
        ...strategy.headers,
      };

      // Prepare body if present
      let bodyString: string | undefined;
      if (strategy.body) {
        if (typeof strategy.body === "string") {
          bodyString = strategy.body;
        } else {
          bodyString = JSON.stringify(strategy.body);
          if (!headers["Content-Type"]) {
            headers["Content-Type"] = "application/json";
          }
        }
      }

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        // Make HTTP request
        const response = await fetch(url, {
          method,
          headers,
          body: bodyString,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const responseBody = await response.text();
        const duration = Date.now() - startTime;

        // Check expected status
        const expectedStatus = strategy.expectedStatus ?? 200;
        const statusMatch = checkStatusMatch(response.status, expectedStatus);

        // Check response pattern if specified
        let patternMatch = true;
        if (strategy.expectedBodyPattern) {
          const regex = new RegExp(strategy.expectedBodyPattern);
          patternMatch = regex.test(responseBody);
        }

        // Check JSON assertions if specified
        let jsonAssertionsMatch = true;
        let jsonAssertionErrors: string[] = [];
        if (strategy.jsonAssertions && strategy.jsonAssertions.length > 0) {
          const assertionResult = checkJsonAssertions(responseBody, strategy.jsonAssertions);
          jsonAssertionsMatch = assertionResult.success;
          jsonAssertionErrors = assertionResult.errors;
        }

        const success = statusMatch && patternMatch && jsonAssertionsMatch;

        return {
          success,
          output: formatOutput(response.status, responseBody, !statusMatch, !patternMatch, jsonAssertionErrors),
          duration,
          details: {
            url,
            method,
            statusCode: response.status,
            expectedStatus,
            statusMatch,
            patternMatch: strategy.expectedBodyPattern ? patternMatch : undefined,
            jsonAssertionsMatch: strategy.jsonAssertions ? jsonAssertionsMatch : undefined,
            jsonAssertionErrors: jsonAssertionErrors.length > 0 ? jsonAssertionErrors : undefined,
          },
        };
      } catch (fetchError) {
        clearTimeout(timeoutId);
        throw fetchError;
      }
    } catch (error) {
      const duration = Date.now() - startTime;

      if ((error as Error).name === "AbortError") {
        return {
          success: false,
          output: `HTTP request timed out after ${timeout}ms`,
          duration,
          details: {
            reason: "timeout",
            timeout,
            url: strategy.url,
          },
        };
      }

      return {
        success: false,
        output: `HTTP request failed: ${(error as Error).message}`,
        duration,
        details: {
          reason: "request-failed",
          error: (error as Error).message,
          url: strategy.url,
        },
      };
    }
  }
}
