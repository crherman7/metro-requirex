/**
 * Dynamically requires a module by its name using Metro's weak module resolution.
 *
 * @param {string} moduleName - The name of the module to require.
 * @returns {unknown} The required module if found, otherwise `null`.
 *
 * @throws {Error} If the module cannot be found or loaded.
 *
 * @example
 * ```typescript
 * const myModule = requirex('my-module');
 * if (myModule) {
 *   // Use the module
 * } else {
 *   console.error('Module not found');
 * }
 * ```
 *
 * @remarks
 * This function uses Metro's `resolveWeak` method to resolve the module ID.
 * If the module ID is a number and the global `__r` function is available,
 * it will use `__r` to require the module. If the module cannot be found,
 * an error is thrown and caught, logging the failure and returning `null`.
 */
export function requirex(moduleName: string): unknown {
  // We should declare the module map outside the function to avoid recreating it on each call
  // In a real implementation, this would be populated with actual module mappings
  const METRO_REQUIREX_MODULE_MAP: Record<string, number> = {};

  try {
    const moduleId = METRO_REQUIREX_MODULE_MAP[moduleName];

    if (!moduleId) {
      throw new Error(`Module "${moduleName}" not found in dependency graph.`);
    }

    // Verify that the Metro require function exists
    if (typeof global.__r !== 'function') {
      throw new Error(
        'Metro require function (__r) is not available in the global scope.',
      );
    }

    // Since we've verified moduleId exists and __r is a function, we can safely call it
    return global.__r(moduleId);
  } catch (err) {
    // Use a more descriptive error message with the actual error
    console.error(
      `Failed to dynamically require "${moduleName}":`,
      err instanceof Error ? err.message : String(err),
    );

    // Return null to indicate failure
    return null;
  }
}

/**
 * Evaluates a string of JavaScript code in a strict mode context and returns the result.
 *
 * This function creates a new function with the provided code and executes it with
 * `require`, `module`, and `exports` as arguments. The evaluated code can use these
 * arguments to import modules and export values.
 *
 * @template T - The expected return type of the evaluated code.
 * @param {string} code - The JavaScript code to evaluate.
 * @returns {T} - The result of the evaluated code, cast to the specified type.
 *
 * @example
 * ```typescript
 * const result = evalx<number>('module.exports = 42;');
 * console.log(result); // 42
 * ```
 */
export function evalx<T = unknown>(code: string): T {
  return new Function(
    'require',
    'global',
    'module',
    'exports',
    `"use strict";\n${code}\n return module.exports;`,
  )(requirex, global, {}, {}) as T;
}
