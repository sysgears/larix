import * as fs from 'fs';
import * as path from 'path';

import { findNodeModule } from '../resolve';

const getPrefabs = (depList, nodeModulesDirs: string[]) => {
  let prefabs = {};
  depList.forEach(dep => {
    const modulePath = findNodeModule(dep, nodeModulesDirs);
    if (modulePath) {
      const pkg = JSON.parse(fs.readFileSync(path.join(modulePath, 'package.json'), 'utf8'));
      const prefab = pkg.prefab || pkg.larix;
      if (prefab) {
        prefabs = { ...prefabs, [dep]: pkg, ...getPrefabs(Object.keys(pkg.dependencies || {}), nodeModulesDirs) };
      }
    }
  });
  return prefabs;
};

export const getDependentPrefabs = (pkgJsonPath: string, nodeModulesDirs: string[], removedDeps?: string[]) => {
  if (fs.existsSync(pkgJsonPath)) {
    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    const deps = [];
    ['dependencies', 'optionalDependencies'].forEach(section => {
      for (const dep of Object.keys(pkgJson[section] || {})) {
        if (deps.indexOf(dep) < 0 && (!removedDeps || removedDeps.indexOf(dep) < 0)) {
          deps.push(dep);
        }
      }
    });

    return getPrefabs(deps, nodeModulesDirs);
  } else {
    return [];
  }
};
