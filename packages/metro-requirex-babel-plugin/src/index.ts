import * as fs from 'node:fs';
import * as path from 'node:path';
import * as t from '@babel/types';
import type {NodePath} from '@babel/traverse';
import type * as Babel from '@babel/core';

export default function (): Babel.PluginObj {
  return {
    name: 'rechunk-babel-plugin',
    visitor: {
      FunctionDeclaration(p: NodePath<t.FunctionDeclaration>, state) {
        // Ensure we are modifying `requirex` only
        if (!t.isIdentifier(p.node.id, {name: 'requirex'})) {
          return;
        }

        const packageJsonPath = path.resolve(
          state.file.opts.root,
          'package.json',
        );
        if (!fs.existsSync(packageJsonPath)) {
          console.warn('[Babel Plugin] No package.json found.');
          return;
        }

        // Read package.json and extract dependencies
        const packageJson = JSON.parse(
          fs.readFileSync(packageJsonPath, 'utf-8'),
        ) as {
          dependencies?: Record<string, string>;
          peerDependencies?: Record<string, string>;
        };

        const dependencies = {
          ...packageJson.dependencies,
          ...packageJson.peerDependencies,
        };

        // Generate module map entries
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

        let moduleMapUpdated = false;

        // Find `METRO_REQUIREX_MODULE_MAP` inside `requirex`
        p.traverse({
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

        if (!moduleMapUpdated) {
          console.warn(
            '[Babel Plugin] No METRO_REQUIREX_MODULE_MAP found inside requirex().',
          );
        }
      },
    },
  };
}
