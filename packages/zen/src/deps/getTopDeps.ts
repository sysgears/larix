import * as fs from 'fs';
import * as path from 'path';
import merge from 'webpack-merge';

import { RequireFunction } from '../createRequire';

import upDirs from '../upDirs';

export interface Dependencies {
  dependencies?: { [x: string]: string };
  devDependencies?: { [x: string]: string };
}

const depsCache = {};
const existsCache = {};

const getTopDeps = (
  packageJsonPath: string,
  projectRoot: string,
  requireDep: RequireFunction,
  seen = []
): Dependencies => {
  const filePath = path.resolve(packageJsonPath);
  let hasSeen = false;
  let result = {};
  if (!depsCache[filePath]) {
    const candidateDirs = upDirs(path.dirname(packageJsonPath), 'node_modules', projectRoot);
    const nodeModuleDirs = [];
    for (const dir of candidateDirs) {
      if (!existsCache[dir]) {
        existsCache[dir] = fs.existsSync(dir);
      }
      if (existsCache[dir]) {
        nodeModuleDirs.push(dir);
      }
    }

    const pkg = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    for (const depGroup of ['dependencies', 'devDependencies']) {
      for (const depName of Object.keys(pkg[depGroup] || {})) {
        if (seen.indexOf(depName) < 0) {
          for (const nodeModuleDir of nodeModuleDirs) {
            const moduleDirPath = path.join(nodeModuleDir, depName);
            try {
              if (fs.lstatSync(moduleDirPath).isSymbolicLink()) {
                const modPkgJsonPath = path.join(moduleDirPath, 'package.json');
                let topDeps = getTopDeps(modPkgJsonPath, projectRoot, requireDep, seen.concat([depName]));
                if (depGroup !== 'dependencies') {
                  topDeps = { devDependencies: { ...topDeps.dependencies, ...topDeps.devDependencies } };
                }
                result = (merge as any).smart(result, topDeps);
              } else {
                result[depGroup] = result[depGroup] || {};
                result[depGroup][depName] = pkg[depGroup][depName];
              }
            } catch (e) {
              // continue, regardless of error
            }
          }
        } else {
          hasSeen = true;
        }
      }
    }
  } else {
    result = depsCache[filePath];
  }
  if (!hasSeen) {
    depsCache[filePath] = result;
  }
  return result;
};

export default getTopDeps;
