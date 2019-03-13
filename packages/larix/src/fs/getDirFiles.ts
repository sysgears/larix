import * as fs from 'fs';
import * as path from 'path';

export const getDirFiles = (dir: string, relDir?: string): string[] =>
  fs.readdirSync(dir).reduce((res: string[], file: string) => {
    if (file.indexOf('.larix') !== 0) {
      if (fs.statSync(path.join(dir, file)).isDirectory()) {
        res.push(...getDirFiles(path.join(dir, file), relDir ? path.join(relDir, file) : file));
      } else {
        res.push(relDir ? path.join(relDir, file) : file);
      }
    }
    return res;
  }, []);
