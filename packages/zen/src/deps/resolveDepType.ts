import * as fs from 'fs';
import * as path from 'path';

import { RequireFunction } from '../createRequire';

export enum ModuleType {
  ProjectSource = 0,
  ProjectModule = 1,
  TranspiledNodeModule = 2,
  NormalNodeModule = 3
}

export interface ResolveResult {
  realPath: string;
  moduleType: ModuleType;
}

const resolvePackagesCache: { [pkgPath: string]: ResolveResult } = {};
const resolveModulesCache: { [modulePath: string]: ResolveResult } = {};
const KNOWN_RN_PACKAGES = [/expo.*/, /@expo.*/, /react-navigation.*/, /react-native.*/];

export default (depPath: string, projectRoot: string, requireDep: RequireFunction): ResolveResult => {
  if (!projectRoot) {
    throw new Error('Project root undefined!');
  }
  const idx = depPath.lastIndexOf(path.sep + 'node_modules' + path.sep);
  if (idx >= 0) {
    if (resolveModulesCache[depPath] === undefined) {
      const pkgPathStart = depPath[idx + 14] !== '@' ? idx + 14 : depPath.indexOf(path.sep, idx + 14) + 1;
      let pkgPathEnd = depPath.indexOf(path.sep, pkgPathStart);
      if (pkgPathEnd < 0) {
        pkgPathEnd = depPath.length;
      }
      const pkgPath = depPath.substr(0, pkgPathEnd);
      if (resolvePackagesCache[pkgPath] === undefined) {
        const pkgName = pkgPath.substr(idx + 14);
        let moduleType: ModuleType = ModuleType.NormalNodeModule;
        let resolvedPath = pkgPath;
        try {
          if (fs.lstatSync(pkgPath).isSymbolicLink()) {
            const realPath = fs.realpathSync(pkgPath);
            resolvedPath = realPath;
            if (realPath.indexOf(projectRoot) === 0) {
              moduleType = ModuleType.ProjectModule;
            }
          }
        } catch (e) {
          // continue, regardless of error
        }
        if (moduleType === ModuleType.NormalNodeModule && KNOWN_RN_PACKAGES.some(regex => regex.test(pkgName))) {
          moduleType = ModuleType.TranspiledNodeModule;
        }
        if (moduleType === ModuleType.NormalNodeModule) {
          let entryFileText;
          let modulePath;
          try {
            modulePath = requireDep.resolve(pkgName);
          } catch (e) {
            // continue, regardless of error
          }
          if (!modulePath) {
            try {
              const pkgJson = requireDep(pkgName + '/package.json');
              if (pkgJson.module) {
                modulePath = pkgJson.module;
                moduleType = ModuleType.TranspiledNodeModule;
              }
            } catch (e) {
              // continue, regardless of error
            }
          }
          if (modulePath && moduleType === ModuleType.NormalNodeModule) {
            try {
              entryFileText = fs.readFileSync(modulePath, 'utf8');
            } catch (e) {
              // continue, regardless of error
            }
            if (
              entryFileText &&
              entryFileText.indexOf('__esModule') < 0 &&
              /^(export|import)[\s]/m.test(entryFileText)
            ) {
              moduleType = ModuleType.TranspiledNodeModule;
            }
          }
        }
        resolvePackagesCache[pkgPath] = {
          realPath: resolvedPath,
          moduleType
        };
      }
      const resolvedPkg = resolvePackagesCache[pkgPath];
      resolveModulesCache[depPath] = {
        realPath: path.join(resolvedPkg.realPath, depPath.substr(pkgPathEnd + 1)),
        moduleType: resolvedPkg.moduleType
      };
    }
    return resolveModulesCache[depPath];
  } else {
    // console.log({ realPath: modulePath, moduleType: ModuleType.ProjectSource });
    return { realPath: depPath, moduleType: ModuleType.ProjectSource };
  }
};
