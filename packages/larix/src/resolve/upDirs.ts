import * as path from 'path';

export default (rootPath: string, relPath = '.'): string[] => {
  const paths = [];
  let curDir = rootPath;
  let lastIdx;
  do {
    lastIdx = curDir.lastIndexOf(path.sep, curDir.length - 1);
    paths.push(path.join(curDir + (lastIdx < 0 ? path.sep : ''), relPath));
    if (lastIdx < 0) {
      break;
    }
    curDir = curDir.substring(0, lastIdx);
  } while (lastIdx >= 0);

  return paths;
};
