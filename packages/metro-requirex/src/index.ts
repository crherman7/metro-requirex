/**
 * An extension of the Node.js `NodeRequire` interface to include a method for weakly resolving module names.
 *
 * @interface MetroRequire
 * @extends {NodeRequire}
 *
 * @method resolveWeak
 * @memberof MetroRequire
 * @param {string} moduleName - The name of the module to resolve.
 * @returns {number} - A numeric identifier for the module, or -1 if the module cannot be resolved.
 *
 * @example
 * const moduleId = require.resolveWeak('some-module');
 * if (moduleId !== -1) {
 *   // Module is available and can be required
 *   const someModule = require('some-module');
 * }
 */
interface MetroRequire extends NodeJS.Require {
  resolveWeak: (moduleName: string) => number;
}

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
export const requirex = (moduleName: string): unknown => {
  try {
    const moduleId = (require as MetroRequire).resolveWeak(moduleName);

    if (typeof moduleId === 'number' && global.__r) {
      return global.__r(moduleId);
    }

    throw new Error(`Module "${moduleName}" not found.`);
  } catch (err) {
    console.error(`Failed to dynamically require "${moduleName}":`, err);
    return null;
  }
};

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
export const evalx = <T = unknown>(code: string): T => {
  return new Function(
    'require',
    'module',
    'exports',
    `"use strict";\n${code}\n return module.exports;`,
  )(requirex, {}, {}) as T;
};
