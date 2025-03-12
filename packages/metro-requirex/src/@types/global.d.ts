/**
 * Declares a global variable `__r` which is a function that takes a module ID as a parameter
 * and returns an unknown type. This is typically used internally by the Metro bundler.
 *
 * The Metro bundler is a JavaScript bundler commonly used with React Native. It uses the `__r`
 * function to require modules by their ID during the bundling process.
 *
 * @global
 * @var __r
 * @param {number} moduleId - The ID of the module to be required.
 * @returns {unknown} The module that corresponds to the given module ID.
 */
declare global {
  // eslint-disable-next-line no-var
  var __r: (moduleId: number) => unknown;
}

export {};
