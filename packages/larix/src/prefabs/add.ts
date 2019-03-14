import * as diff from 'diff';
import * as fs from 'fs-extra';
import * as path from 'path';

import { merge, parsePatch, readMaybeConflictedFile } from '../diff';
import { findNodeModule, findNodeModulesDirs } from '../resolve';
import { downloadPrefab } from './download';
import { getDependentPrefabs } from './get';

interface AddPrefabsOptions {
  projectRoot: string;
  registryUrl: string;
  cacheDir: string;
}

export const addPrefabs = async (options: AddPrefabsOptions) => {
  const nodeModulesDirs = findNodeModulesDirs(options.projectRoot);
  const prefabs = getDependentPrefabs(path.join(options.projectRoot, 'package.json'), nodeModulesDirs);
  for (const key of Object.keys(prefabs)) {
    const prefab = path.join(options.projectRoot, prefabs[key].larix || prefabs[key].prefab);
    const prefabInstallDir = findNodeModule(key, nodeModulesDirs);
    const dir = fs.realpathSync(prefabInstallDir);
    if (fs.existsSync(path.join(prefab, 'package.json'))) {
      const nodeModulesPkgJson = JSON.parse(fs.readFileSync(path.join(prefabInstallDir, 'package.json'), 'utf8'));
      const appPkgJson = readMaybeConflictedFile(path.join(prefab, 'package.json'));
      const appModulePkgJson = JSON.parse(appPkgJson.unified ? appPkgJson.unified : appPkgJson.yours);
      if (nodeModulesPkgJson.version !== appModulePkgJson.version) {
        const oldPrefabDir = await downloadPrefab({
          name: nodeModulesPkgJson.name,
          version: appModulePkgJson.version,
          registryUrl: options.registryUrl,
          cacheDir: options.cacheDir
        });
        await merge(prefab, oldPrefabDir, prefabInstallDir);
      }
      fs.removeSync(prefabInstallDir);
    } else {
      if (!fs.existsSync(prefab)) {
        fs.mkdirpSync(path.dirname(prefab));
        fs.renameSync(dir, prefab);
      } else {
        fs.copySync(dir, prefab);
        fs.removeSync(dir);
      }
    }
    fs.symlinkSync(path.relative(path.dirname(dir), path.resolve(prefab)), dir);
    const patchPath = path.join(prefab, path.basename(prefab) + '.patch');
    if (fs.existsSync(patchPath)) {
      const parsedPatch = parsePatch(fs.readFileSync(patchPath, 'utf8'));
      const files = [];
      for (const patch of parsedPatch.diffs) {
        const filePath = path.join(prefab, patch.newFileName);
        const contents = diff.applyPatch(fs.readFileSync(filePath, 'utf8'), patch);
        if (!contents) {
          throw new Error('Applying patch: ' + patchPath + ' failed');
        }
        files.push({
          filePath,
          contents
        });
      }
      for (const file of files) {
        fs.writeFileSync(file.filePath, file.contents);
      }
      fs.removeSync(patchPath);
    }
  }
};
