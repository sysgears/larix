import * as fs from 'fs-extra';
import * as path from 'path';

import { createPatch, patchToStr } from '../diff';
import { findNodeModule, findNodeModulesDirs } from '../resolve';
import { downloadPrefab } from './download';
import { getDependentPrefabs } from './get';

const removeDirAndEmptyDirsUp = moduleDir => {
  fs.removeSync(moduleDir);
  let dir = path.dirname(moduleDir);
  do {
    // Safeguard
    if (fs.readdirSync(dir).length === 0) {
      fs.removeSync(dir);
    } else {
      break;
    }
    dir = path.dirname(dir);
  } while (dir.length > 0);
};

interface RemovePrefabsOptions {
  projectRoot: string;
  packageNames: string[];
  registryUrl: string;
  cacheDir: string;
}

export const removePrefabs = async (options: RemovePrefabsOptions) => {
  const nodeModulesDirs = findNodeModulesDirs(options.projectRoot);
  const pkgJsonDir = path.join(options.projectRoot, 'package.json');
  const allPrefabs = Object.keys(getDependentPrefabs(pkgJsonDir, nodeModulesDirs));
  const prefabsAfterRemoval = Object.keys(getDependentPrefabs(pkgJsonDir, options.packageNames));
  const prefabsToRemove = [];
  for (const prefab of allPrefabs) {
    if (prefabsAfterRemoval.indexOf(prefab) < 0) {
      prefabsToRemove.push(prefab);
    }
  }
  for (const prefab of prefabsToRemove) {
    const prefabDir = findNodeModule(prefab, nodeModulesDirs);
    if (prefabDir) {
      const pkgJson = JSON.parse(fs.readFileSync(path.join(prefabDir, 'package.json'), 'utf8'));
      const realDir = fs.realpathSync(prefabDir);
      const prefabCacheDir = await downloadPrefab({
        name: pkgJson.name,
        version: pkgJson.version,
        registryUrl: options.registryUrl,
        cacheDir: options.cacheDir
      });
      const patch = patchToStr(createPatch(prefabCacheDir, realDir, options.cacheDir));
      try {
        removeDirAndEmptyDirsUp(realDir);
        removeDirAndEmptyDirsUp(prefabDir);
      } finally {
        if (patch.length > 0) {
          fs.mkdirpSync(realDir);
          fs.writeFileSync(path.join(realDir, path.basename(realDir) + '.patch'), patch);
        }
      }
    }
  }
};
