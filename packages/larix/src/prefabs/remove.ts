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

export const removePrefabs = async (packageNames, registry) => {
  const nodeModulesDirs = findNodeModulesDirs();
  const allPrefabs = Object.keys(getDependentPrefabs('package.json', nodeModulesDirs));
  const prefabsAfterRemoval = Object.keys(getDependentPrefabs('package.json', packageNames));
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
      const prefabCacheDir = await downloadPrefab(pkgJson.name, pkgJson.version, registry);
      const patch = patchToStr(createPatch(prefabCacheDir, realDir), pkgJson.version);
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
