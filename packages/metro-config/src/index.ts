import path from 'node:path';
import SparkMD5 from 'spark-md5';

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
  const internalUsedIds = new Set<number>();
  const fileToIdMap: Record<string, number> = {};

  return ({path: modulePath}: {path: string}): number => {
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
 * @param modulePath - Absolute path to the module
 * @returns Relative path inside node_modules
 * @throws Error if node_modules is not found in the path
 */
function getExternalModuleRelativePath(modulePath: string): string {
  const nodeModulesIndex = modulePath.lastIndexOf('node_modules');
  if (nodeModulesIndex === -1) {
    throw new Error(`Module is not inside node_modules: ${modulePath}`);
  }

  const afterNodeModules = modulePath.slice(
    nodeModulesIndex + 'node_modules'.length + 1,
  );

  const withoutExtension = afterNodeModules.replace(/\.(cjs|mjs|[jt]sx?)$/, '');
  return withoutExtension.replace(/\\/g, '/'); // Normalize for Windows
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
 * @param input - String to hash
 * @param usedIds - Set of already used IDs to avoid collisions
 * @returns Unique numeric ID derived from the input
 */
function hashToUniqueNumericId(input: string, usedIds: Set<number>): number {
  let id = hashToNumericId(input);
  while (usedIds.has(id)) id++;
  usedIds.add(id);
  return id;
}
