import * as fs from 'node:fs';
import * as path from 'node:path';
import * as t from '@babel/types';
import type {NodePath} from '@babel/traverse';
import type * as Babel from '@babel/core';

/**
 * A Babel plugin that automatically populates the METRO_REQUIREX_MODULE_MAP with
 * module IDs from package.json dependencies.
 *
 * This plugin addresses a critical limitation: `require.resolveWeak` must be called
 * with string literals at compile time, not dynamic values at runtime. The plugin
 * statically analyzes package.json and generates the necessary string literal calls
 * to `require.resolveWeak` for each dependency during the build process.
 *
 * Without this transformation, developers would need to manually create entries for
 * each dependency with hardcoded string literals, which is error-prone and difficult
 * to maintain as dependencies change.
 *
 * The plugin targets the 'requirex' function declaration and modifies its
 * internal METRO_REQUIREX_MODULE_MAP variable to include all dependencies and
 * peerDependencies using compile-time available module IDs.
 *
 * @returns {Babel.PluginObj} A Babel plugin object with visitor patterns
 */
export default function (): Babel.PluginObj {
  return {
    name: 'rechunk-babel-plugin',
    visitor: {
      /**
       * Processes function declarations to specifically find and modify the 'requirex' function.
       *
       * @param {NodePath<t.FunctionDeclaration>} p - The path to the current function declaration node
       * @param {Babel.PluginPass} state - The state object provided by Babel containing metadata about the transformation
       */
      FunctionDeclaration(
        p: NodePath<t.FunctionDeclaration>,
        state: Babel.PluginPass,
      ) {
        // Ensure we are modifying `requirex` only
        if (!t.isIdentifier(p.node.id, {name: 'requirex'})) {
          return;
        }

        /**
         * Path to the project's package.json file.
         * Uses the root path provided by Babel's state object.
         */
        const packageJsonPath = path.resolve(
          state.file.opts.root || process.cwd(),
          'package.json',
        );
        if (!fs.existsSync(packageJsonPath)) {
          console.warn('[Babel Plugin] No package.json found.');
          return;
        }

        /**
         * Parse and extract dependency information from package.json.
         * We're interested in both regular dependencies and peer dependencies.
         */
        const packageJson = JSON.parse(
          fs.readFileSync(packageJsonPath, 'utf-8'),
        ) as {
          dependencies?: Record<string, string>;
          peerDependencies?: Record<string, string>;
        };

        /**
         * Merge dependencies and peerDependencies into a single object.
         * This will be used to generate the module map entries.
         */
        const dependencies = {
          ...packageJson.dependencies,
          ...packageJson.peerDependencies,
        };

        /**
         * Generate AST objects representing module map entries.
         * Each entry maps a package name to its module ID using require.resolveWeak.
         *
         * Example output:
         * { "package-name": require.resolveWeak("package-name") }
         */
        const moduleMapProperties = Object.keys(dependencies).map(dep =>
          t.objectProperty(
            t.stringLiteral(dep),
            t.callExpression(
              t.memberExpression(
                t.identifier('require'),
                t.identifier('resolveWeak'),
              ),
              [t.stringLiteral(dep)],
            ),
          ),
        );

        /**
         * Flag to track whether we successfully updated the module map.
         * Will be used to display a warning if no map was found.
         */
        let moduleMapUpdated = false;

        /**
         * Search within the 'requirex' function to find the METRO_REQUIREX_MODULE_MAP
         * variable declaration and update its initialization.
         */
        p.traverse({
          /**
           * Handle variable declarations to find and update METRO_REQUIREX_MODULE_MAP.
           *
           * @param {NodePath<t.VariableDeclarator>} variablePath - The path to the current variable declaration
           */
          VariableDeclarator(variablePath: NodePath<t.VariableDeclarator>) {
            if (
              t.isIdentifier(variablePath.node.id, {
                name: 'METRO_REQUIREX_MODULE_MAP',
              }) &&
              t.isObjectExpression(variablePath.node.init)
            ) {
              // Replace the empty object with the generated module map
              variablePath
                .get('init')
                .replaceWith(t.objectExpression(moduleMapProperties));
              moduleMapUpdated = true;
            }
          },
        });

        /**
         * Display a warning if we couldn't find the METRO_REQUIREX_MODULE_MAP variable
         * in the requirex function.
         */
        if (!moduleMapUpdated) {
          console.warn(
            '[Babel Plugin] No METRO_REQUIREX_MODULE_MAP found inside requirex().',
          );
        }
      },
    },
  };
}
