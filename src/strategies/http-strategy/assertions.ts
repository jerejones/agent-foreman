/**
 * HTTP Response Assertions
 */

/**
 * Check if response status matches expected
 */
export function checkStatusMatch(actual: number, expected: number | number[]): boolean {
  if (Array.isArray(expected)) {
    return expected.includes(actual);
  }
  return actual === expected;
}

/**
 * Check JSON assertions on response body
 */
export function checkJsonAssertions(
  responseBody: string,
  assertions: Array<{ path: string; expected: unknown }>
): { success: boolean; errors: string[] } {
  const errors: string[] = [];

  try {
    const json = JSON.parse(responseBody);

    for (const assertion of assertions) {
      const actualValue = getJsonPath(json, assertion.path);

      if (!deepEqual(actualValue, assertion.expected)) {
        errors.push(
          `JSONPath '${assertion.path}': expected ${JSON.stringify(assertion.expected)}, got ${JSON.stringify(actualValue)}`
        );
      }
    }

    return { success: errors.length === 0, errors };
  } catch (error) {
    return {
      success: false,
      errors: [`Failed to parse response as JSON: ${(error as Error).message}`],
    };
  }
}

/**
 * Simple JSONPath implementation (supports dot notation and array access)
 * e.g., "data.user.name", "items[0].id", "results[*].status"
 */
export function getJsonPath(obj: unknown, path: string): unknown {
  const parts = path.split(/\.|\[|\]/).filter((p) => p !== "");
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (part === "*" && Array.isArray(current)) {
      // Wildcard: return array of values at next path
      return current;
    }

    if (typeof current === "object" && current !== null) {
      const index = parseInt(part, 10);
      if (!isNaN(index) && Array.isArray(current)) {
        current = current[index];
      } else {
        current = (current as Record<string, unknown>)[part];
      }
    } else {
      return undefined;
    }
  }

  return current;
}

/**
 * Deep equality check
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((val, i) => deepEqual(val, b[i]));
  }
  if (typeof a === "object" && typeof b === "object") {
    const aKeys = Object.keys(a as Record<string, unknown>);
    const bKeys = Object.keys(b as Record<string, unknown>);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((key) =>
      deepEqual(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key]
      )
    );
  }
  return false;
}
