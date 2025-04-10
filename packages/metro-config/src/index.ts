import fs from 'node:fs';
import path from 'node:path';
import SparkMD5 from 'spark-md5';
import findUp from 'find-up';
import * as t from '@babel/types';
import traverse, {TraverseOptions} from '@babel/traverse';
import generate from '@babel/generator';
import * as parser from '@babel/parser';

/**
 * Configuration options for `@metro-requirex/metro-config`.
 *
 * @remarks
 * This config allows you to control behavior for how `metro-requirex` modifies
 * the React Native runtime, including dependency injection at bundle startup.
 */
export type MetroRequirexConfig = {
  /**
   * Whether to eagerly `require()` all top-level `dependencies` from your
   * project's `package.json` into the `InitializeCore.js` entry file.
   *
   * @remarks
   * This ensures that all runtime dependencies are resolved and executed as
   * early as possible — before your app entry point.
   *
   * This is useful if:
   * - You want to preload side-effect-only modules that might otherwise be
   *   tree-shaken by Metro.
   * - You're working with global shims, runtime setups, or polyfills that
   *   need to be initialized early.
   * - You want to ensure a more consistent startup environment across devices
   *   and reloads.
   *
   * If enabled, `@metro-requirex/metro-config` will automatically locate
   * `InitializeCore.js`, parse it via Babel, and inject `require(...)` calls
   * for each dependency not already included.
   *
   * Safe to run repeatedly — injected modules will not be duplicated.
   *
   * @defaultValue false
   *
   * @example
   * ```ts
   * export const config: MetroRequirexConfig = {
   *   eager: true
   * };
   * ```
   */
  eager?: boolean;
};

/**
 * Parses a JavaScript file into an abstract syntax tree (AST), applies
 * a Babel `traverse` visitor pattern to it, and writes the transformed
 * code back to disk if changes are detected.
 *
 * @remarks
 * This function is designed to be used for safe, programmatic AST
 * manipulation — useful in build pipelines, bundler config hooks,
 * or code-mod tools.
 *
 * The function resolves the provided file path (absolute or package-resolved),
 * loads the file content, and parses it using Babel’s parser with support
 * for ES modules and JSX.
 *
 * It then applies the provided `visitors` to the AST via Babel Traverse.
 * If the transformed code differs from the original, the file is overwritten.
 *
 * @param filePath - The path to the JavaScript file to process. Can be
 * either an absolute path or a path resolvable via `require.resolve`.
 *
 * @param visitors - A Babel `TraverseOptions` object representing a visitor
 * pattern to walk and optionally modify the AST.
 *
 * @throws Will throw an error if the resolved file path does not exist.
 *
 * @example
 * ```ts
 * await withJS({
 *   filePath: 'react-native/Libraries/Core/InitializeCore.js',
 *   visitors: {
 *     Program: {
 *       enter(path) {
 *         // inject a require('some-package') at the top
 *       }
 *     }
 *   }
 * });
 * ```
 *
 * @see {@link https://babeljs.io/docs/en/babel-traverse}
 */
export async function withJS({
  filePath,
  visitors,
}: {
  filePath: string;
  visitors: TraverseOptions;
}) {
  const resolvedPath = path.isAbsolute(filePath)
    ? filePath
    : require.resolve(filePath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`File not found: ${resolvedPath}`);
  }

  const originalCode = fs.readFileSync(resolvedPath, 'utf-8');

  const ast = parser.parse(originalCode, {
    sourceType: 'module',
    plugins: ['jsx'],
  });

  traverse(ast, visitors);

  const {code} = generate(ast);

  if (code !== originalCode) {
    fs.writeFileSync(resolvedPath, code, 'utf-8');
  }
}

/**
 * Wraps a Metro configuration object with a custom createModuleIdFactory
 * for use with metro-requirex. Ensures deterministic module IDs across builds.
 *
 * @param baseConfig - Existing Metro config
 * @returns Modified Metro config with custom createModuleIdFactory
 */
export function withMetroRequirexConfig(
  baseConfig: {
    serializer?: {createModuleIdFactory?: () => (path: string) => number};
    projectRoots?: string[];
  },
  {eager = false}: MetroRequirexConfig,
) {
  if (eager) {
    const START_MARKER = '@metro-requirex start';
    const END_MARKER = '@metro-requirex end';
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pkgJSON = require(path.resolve(process.cwd(), 'package.json'));
    const dependencies = [
      ...Object.keys(pkgJSON.dependencies ?? {}),
      'react/jsx-runtime',
    ];
    const filePath = path.resolve(
      path.dirname(
        require.resolve('react-native', {
          paths: [process.cwd()],
        }),
      ),
      'Libraries',
      'Core',
      'InitializeCore.js',
    );

    withJS({
      filePath,
      visitors: {
        Program: {
          enter(path) {
            const body = path.node.body;

            // --- 1. Remove previously injected section ---
            const startIndex = body.findIndex(node =>
              node.leadingComments?.some(
                comment => comment.value.trim() === START_MARKER,
              ),
            );

            const endIndex = body.findIndex(node =>
              node.leadingComments?.some(
                comment => comment.value.trim() === END_MARKER,
              ),
            );

            if (
              startIndex !== -1 &&
              endIndex !== -1 &&
              endIndex >= startIndex
            ) {
              body.splice(startIndex, endIndex - startIndex + 1);
            }

            // --- 2. Re-inject fresh requires from package.json ---
            const requireNodes = dependencies.map(dep =>
              t.expressionStatement(
                t.callExpression(t.identifier('require'), [
                  t.stringLiteral(dep),
                ]),
              ),
            );

            // Add comment markers
            const startComment = t.emptyStatement();
            startComment.leadingComments = [
              {type: 'CommentLine', value: ` ${START_MARKER}`},
            ];

            const endComment = t.emptyStatement();
            endComment.leadingComments = [
              {type: 'CommentLine', value: ` ${END_MARKER}`},
            ];

            // Push to end of file
            body.push(startComment, ...requireNodes, endComment);
          },
        },
      },
    });
  }

  return {
    ...baseConfig,
    serializer: {
      ...baseConfig.serializer,
      createModuleIdFactory: () =>
        createMetroRequireModuleIdFactory({
          projectRoots: baseConfig.projectRoots ?? [process.cwd()],
        }),
    },
  };
}

/**
 * Creates a module ID factory for Metro bundler that generates consistent
 * numeric IDs for JavaScript modules.
 *
 * This factory produces deterministic module IDs for React Native applications
 * bundled with Metro. The deterministic nature ensures that the same module
 * always gets the same numeric ID across builds, which is important for
 * caching, code splitting, and consistent bundle output.
 *
 * @param options - Configuration options
 * @param options.projectRoots - Array of root paths for the project
 * @returns A function that generates numeric IDs for module paths
 */
function createMetroRequireModuleIdFactory({
  projectRoots,
}: {
  projectRoots: string[];
}) {
  // Cache used IDs to ensure uniqueness
  const internalUsedIds = new Set<number>();
  // Cache module paths to IDs for performance
  const fileToIdMap: Record<string, number> = {};

  /**
   * Generates a numeric ID for a given module path
   *
   * @param modulePath - The absolute path to the module
   * @returns A deterministic numeric ID for the module
   */
  return (modulePath: string): number => {
    if (isExternalDependency(modulePath)) {
      const externalPath = getExternalModuleRelativePath(modulePath);
      if (!(externalPath in fileToIdMap)) {
        fileToIdMap[externalPath] = hashToNumericId(externalPath);
      }
      return fileToIdMap[externalPath] as number;
    }

    const relativePath = getPathRelativeToRoot(projectRoots, modulePath);
    if (!(relativePath in fileToIdMap)) {
      fileToIdMap[relativePath] = hashToUniqueNumericId(
        relativePath,
        internalUsedIds,
      );
    }
    return fileToIdMap[relativePath] as number;
  };
}

/**
 * Determines if a module path refers to an external dependency
 *
 * @param modulePath - Absolute path to the module
 * @returns True if the module is an external dependency (in node_modules)
 */
function isExternalDependency(modulePath: string): boolean {
  return modulePath.includes(`node_modules${path.sep}`);
}

/**
 * Extracts the full relative path inside node_modules
 * e.g. lodash/cloneDeep or @babel/runtime/helpers/interopRequireDefault
 *
 * This function normalizes paths for external dependencies by:
 * 1. Finding the package.json for the module
 * 2. Checking if the module is the main entry point
 * 3. Returning the package name for main entry points or the subpath for nested modules
 *
 * @param modulePath - Absolute path to the module
 * @returns Normalized relative path inside node_modules
 * @throws Error if node_modules is not found in the path or package.json cannot be located
 */
function getExternalModuleRelativePath(modulePath: string): string {
  const nodeModulesIndex = modulePath.lastIndexOf('node_modules');
  if (nodeModulesIndex === -1) {
    throw new Error(`Module is not inside node_modules: ${modulePath}`);
  }

  // Find the nearest package.json
  const packageJsonPath = findUp.sync('package.json', {
    cwd: path.dirname(modulePath),
  });

  if (!packageJsonPath) {
    throw new Error(`No package.json found for module: ${modulePath}`);
  }

  try {
    // Parse package.json to determine if this is a main entry point
    const packageDir = path.dirname(packageJsonPath);
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

    // Get the resolved paths for main and react-native entry points
    const mainPath = packageJson.main
      ? path.resolve(packageDir, packageJson.main)
      : path.resolve(packageDir, 'index.js');

    const rnPath = packageJson['react-native']
      ? path.resolve(packageDir, packageJson['react-native'])
      : null;

    // Helper function to normalize paths for comparison
    const normalizePath = (p: string) => p.replace(/\.[^/.]+$/, '');

    // If the modulePath matches either entry point, return the package name
    if (
      normalizePath(path.resolve(modulePath)) === normalizePath(mainPath) ||
      (rnPath &&
        normalizePath(path.resolve(modulePath)) === normalizePath(rnPath))
    ) {
      return packageJson.name;
    }

    // Otherwise, return the subpackage path
    const relativePath = path.relative(packageDir, modulePath);
    return `${packageJson.name}/${relativePath.replace(/\\/g, '/').replace(/\.[^/.]+$/, '')}`;
  } catch (error) {
    // Add more context to file reading/parsing errors
    throw new Error(
      `Failed to process package.json for ${modulePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Gets the path of a module relative to one of the project roots
 *
 * @param projectRoots - Array of root paths for the project
 * @param fullPath - Absolute path to the module
 * @returns Path relative to the first matching project root, with forward slashes
 */
function getPathRelativeToRoot(
  projectRoots: string[],
  fullPath: string,
): string {
  for (const root of projectRoots) {
    if (fullPath.startsWith(root)) {
      const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
      if (fullPath.startsWith(rootWithSep) || fullPath === root) {
        return path.relative(root, fullPath).replace(/\\/g, '/');
      }
    }
  }
  // If no project root matched, return the normalized full path
  return fullPath.replace(/\\/g, '/');
}

/**
 * Converts a string to a deterministic numeric ID using MD5 hashing
 *
 * @param input - String to hash
 * @returns Numeric representation of the first 8 hex characters of the MD5 hash
 */
function hashToNumericId(input: string): number {
  const hex = SparkMD5.hash(input).slice(0, 8);
  return Number.parseInt(hex, 16);
}

/**
 * Generates a unique numeric ID based on a string input
 *
 * This function ensures there are no collisions by incrementing the ID
 * if the originally calculated hash is already in use.
 *
 * @param input - String to hash
 * @param usedIds - Set of already used IDs to avoid collisions
 * @returns Unique numeric ID derived from the input
 */
function hashToUniqueNumericId(input: string, usedIds: Set<number>): number {
  let id = hashToNumericId(input);

  // Increment ID if there's a collision
  while (usedIds.has(id)) {
    id++;
  }

  usedIds.add(id);
  return id;
}
