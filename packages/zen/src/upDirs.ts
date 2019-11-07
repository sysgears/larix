import * as path from 'path';

export default (rootPath: string, relPath = '.', lastDir = '/'): string[] => {
  const paths = [];
  let curDir = rootPath;
  do {
    const lastIdx = curDir.lastIndexOf(path.sep, curDir.length - 1);
    paths.push(path.join(curDir + (lastIdx < 0 ? path.sep : ''), relPath));
    if (lastIdx < 0 || curDir === lastDir) {
      break;
    }
    curDir = curDir.substring(0, lastIdx);
  } while (curDir.length >= lastDir.length);

  return paths;
};
