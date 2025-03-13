// @ts-check

/** @type {import("syncpack").RcFile} */
const config = {
  versionGroups: [
    {
      dependencies: [
        '@repo/typescript-config',
        '@repo/eslint-config',
        '@repo/prettier-config',
      ],
      packages: ['**'],
      dependencyTypes: ['dev'],
      pinVersion: 'workspace:*',
    },
  ],
};

module.exports = config;
