import * as fs from 'fs';
import * as path from 'path';
import upDirs from './upDirs';

export const findNodeModulesDirs = (projectCwd: string) =>
  upDirs(projectCwd, 'node_modules').reduce((res, dir) => res.concat(fs.existsSync(dir) ? [dir] : []), []);

export const findNodeModule = (name, nodeModulesDirs) => {
  for (const dir of nodeModulesDirs) {
    const packageDir = path.join(dir, name);
    if (fs.existsSync(path.join(packageDir, 'package.json'))) {
      return packageDir;
    }
  }
};
