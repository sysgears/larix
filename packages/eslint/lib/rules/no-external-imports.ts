/**
 * @fileoverview No exteral imports outside specific module.
 * @author SysGears INC
 */

'use strict';
import getDependencies from '../../common/no-external-imports';

function missingErrorMessage(packageName: string) {
  return `Can't find '${packageName}' in the packages.json or in related module's package.json.`;
}

function reportIfMissing(
  context: { [key: string]: any },
  node: { [key: string]: any },
  moduleDependencies: Set<string>
) {
  if (!moduleDependencies.has(node.source.value)) {
    context.report(node, missingErrorMessage(node.source.value));
  }
}
// ------------------------------------------------------------------------------
// Rule Definition
// ------------------------------------------------------------------------------
const noExternalImports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'No exteral imports outside specific module.'
    }
  },

  create(context: { [key: string]: any }) {
    // ----------------------------------------------------------------------
    // Helpers
    // ----------------------------------------------------------------------
    const moduleDependencies = new Set();
    getDependencies(context.getFilename(), moduleDependencies);
    // ----------------------------------------------------------------------
    // Public
    // ----------------------------------------------------------------------
    return {
      ImportDeclaration(node: { [key: string]: any }) {
        reportIfMissing(context, node, moduleDependencies);
      }
    };
  }
};
export default noExternalImports;
