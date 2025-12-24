/**
 * URL Validation and SSRF Prevention
 */

import { DEFAULT_ALLOWED_HOSTS } from "./constants.js";

/**
 * Substitute environment variables in URL
 * Supports ${ENV_VAR} syntax
 */
export function substituteEnvVars(url: string, strategyEnv?: Record<string, string>): string {
  const env = { ...process.env, ...strategyEnv };
  return url.replace(/\$\{([^}]+)\}/g, (match, varName) => {
    const value = env[varName];
    return value !== undefined ? value : match;
  });
}

/**
 * Validate URL for SSRF prevention
 */
export function validateUrl(
  url: string,
  allowedHosts?: string[]
): { valid: boolean; error?: string } {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();
    const hosts = allowedHosts ?? DEFAULT_ALLOWED_HOSTS;

    // Check if hostname is in allowed list
    const isAllowed = hosts.some((allowed) => {
      const normalizedAllowed = allowed.toLowerCase();
      // Exact match or wildcard match
      if (normalizedAllowed.startsWith("*.")) {
        const suffix = normalizedAllowed.slice(1);
        return hostname.endsWith(suffix) || hostname === normalizedAllowed.slice(2);
      }
      return hostname === normalizedAllowed;
    });

    if (!isAllowed) {
      return {
        valid: false,
        error: `Host '${hostname}' is not in allowed hosts list. Allowed: ${hosts.join(", ")}`,
      };
    }

    // Block private IP ranges if not explicitly allowed
    if (!isExplicitlyAllowed(hostname, hosts)) {
      if (isPrivateIp(hostname)) {
        return {
          valid: false,
          error: `Private IP addresses are not allowed: ${hostname}`,
        };
      }
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: `Invalid URL: ${(error as Error).message}`,
    };
  }
}

/**
 * Check if hostname is explicitly in allowed list
 */
export function isExplicitlyAllowed(hostname: string, allowedHosts: string[]): boolean {
  return allowedHosts.some((h) => h.toLowerCase() === hostname.toLowerCase());
}

/**
 * Check if hostname is a private IP address
 */
export function isPrivateIp(hostname: string): boolean {
  // Common private IP ranges
  const privatePatterns = [
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^169\.254\./,
    /^fc00:/i,
    /^fd00:/i,
    /^fe80:/i,
  ];

  return privatePatterns.some((pattern) => pattern.test(hostname));
}
