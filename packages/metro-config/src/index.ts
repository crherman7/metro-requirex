import fs from 'node:fs';
import path from 'node:path';
import SparkMD5 from 'spark-md5';
import findUp from 'find-up';

/**
 * Wraps a Metro configuration object with a custom createModuleIdFactory
 * for use with metro-requirex. Ensures deterministic module IDs across builds.
 *
 * @param baseConfig - Existing Metro config
 * @returns Modified Metro config with custom createModuleIdFactory
 */
export function withMetroRequirexConfig(baseConfig: {
  serializer?: {createModuleIdFactory?: () => (path: string) => number};
  projectRoots?: string[];
}) {
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
