import * as fs from 'fs';
import * as path from 'path';

import upDirs from './upDirs';

const getProjectRoot = (cwd: string): string => {
  const pkgPathList = upDirs(cwd, 'package.json');
  let projectRoot;
  for (const pkg of pkgPathList) {
    if (fs.existsSync(pkg)) {
      try {
        JSON.parse(fs.readFileSync(pkg, 'utf8'));
        projectRoot = path.dirname(pkg);
      } catch (e) {
        // continue, regardless of error
      }
    }
  }
  return projectRoot;
};

export default getProjectRoot;
