import * as fs from 'fs';
import * as path from 'path';
import { parsePkgVersionFromPatch } from '../diff';
import { getDirFiles } from '../fs/getDirFiles';

export default class Prefab {
  public baseVersion: string;
  public newVersion: string;

  constructor(dir: string) {
    this._init(dir);
  }

  private _init(dir: string) {
    if (fs.existsSync(dir)) {
      const patchPath = path.join(dir, dir + '.patch');
      const files = getDirFiles(dir);
      if (fs.existsSync(patchPath)) {
        if (files.length > 1) {
          throw new Error(`Unexpected contents of a prefab dir: ${dir}. Expected to find only patch file there`);
        }
        this.baseVersion = parsePkgVersionFromPatch(patchPath);
      } else {
        // TODO: write code
      }
    }
  }
}
