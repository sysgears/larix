import * as fs from 'fs';
import * as path from 'path';

import { Builder } from '../../Builder';

export enum ModuleType {
  ProjectSource = 0,
  ProjectModule = 1,
  TranspiledNodeModule = 2,
  NormalNodeModule = 3
}

interface ResolveResult {
  realPath: string;
  moduleType: ModuleType;
}

const resolvePackagesCache: { [pkgPath: string]: ResolveResult } = {};
const resolveModulesCache: { [modulePath: string]: ResolveResult } = {};
const KNOWN_RN_PACKAGES = [/expo.*/, /@expo.*/, /react-navigation.*/, /react-native.*/];

export default (builder: Builder, modulePath: string): ResolveResult => {
  const idx = modulePath.lastIndexOf(path.sep + 'node_modules' + path.sep);
  if (idx >= 0) {
    if (resolveModulesCache[modulePath] === undefined) {
      const pkgPathStart = modulePath[idx + 14] !== '@' ? idx + 14 : modulePath.indexOf(path.sep, idx + 14) + 1;
      let pkgPathEnd = modulePath.indexOf(path.sep, pkgPathStart);
      if (pkgPathEnd < 0) {
        pkgPathEnd = modulePath.length;
      }
      const pkgPath = modulePath.substr(0, pkgPathEnd);
      if (resolvePackagesCache[pkgPath] === undefined) {
        const pkgName = pkgPath.substr(idx + 14);
        let moduleType: ModuleType = ModuleType.NormalNodeModule;
        let resolvedPath = pkgPath;
        try {
          if (fs.lstatSync(pkgPath).isSymbolicLink()) {
            const realPath = fs.realpathSync(pkgPath);
            resolvedPath = realPath;
            if (realPath.indexOf(builder.projectRoot) === 0) {
              moduleType = ModuleType.ProjectModule;
            }
          }
        } catch (e) {}
        if (moduleType === ModuleType.NormalNodeModule && KNOWN_RN_PACKAGES.some(regex => regex.test(pkgName))) {
          moduleType = ModuleType.TranspiledNodeModule;
        }
        if (moduleType === ModuleType.NormalNodeModule) {
          let entryFileText;
          try {
            entryFileText = fs.readFileSync(builder.require.resolve(pkgName), 'utf8');
          } catch (e) {}
          if (entryFileText && entryFileText.indexOf('__esModule') < 0 && /^(export|import)[\s]/m.test(entryFileText)) {
            moduleType = ModuleType.TranspiledNodeModule;
          }
        }
        resolvePackagesCache[pkgPath] = {
          realPath: resolvedPath,
          moduleType
        };
      }
      const resolvedPkg = resolvePackagesCache[pkgPath];
      resolveModulesCache[modulePath] = {
        realPath: path.join(resolvedPkg.realPath, modulePath.substr(pkgPathEnd + 1)),
        moduleType: resolvedPkg.moduleType
      };
      // console.log(resolveModulesCache[modulePath]);
    }
    return resolveModulesCache[modulePath];
  } else {
    // console.log({ realPath: modulePath, moduleType: ModuleType.ProjectSource });
    return { realPath: modulePath, moduleType: ModuleType.ProjectSource };
  }
};
