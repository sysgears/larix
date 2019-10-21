import * as diff from 'diff';
import * as fs from 'fs-extra';
import * as path from 'path';

// TODO add proper timezone
const getTimestamp = date =>
  date
    .toISOString()
    .replace('T', ' ')
    .replace('Z', '');

export interface Patch {
  [fileName: string]: diff.IUniDiff;
}

export const createPatch = (file1: string, file2: string, basedir1?: string, basedir2?: string): Patch => {
  let patch: Patch = {};
  try {
    if (fs.statSync(file1).isDirectory()) {
      const files1 = fs.readdirSync(file1);
      const files2 = fs.readdirSync(file2);
      const files = files1.concat(files2).filter((val, idx, self) => self.indexOf(val) === idx);
      for (const file of files) {
        if (file.indexOf('.larix-') === 0) {
          continue;
        }
        const filePath1 = path.join(file1, file);
        const filePath2 = path.join(file2, file);
        let stat1;
        let stat2;
        try {
          stat1 = fs.statSync(filePath1);
        } catch (e) {
          // continue, regardless of error
        }
        try {
          stat2 = fs.statSync(filePath2);
        } catch (e) {
          // continue, regardless of error
        }
        // if (!stat1 || !stat2) {
        //   console.log(filePath1, filePath2);
        // }
        const text1 = stat1 && stat1.isFile() ? fs.readFileSync(filePath1, 'utf8') : '';
        const text2 = stat2 && stat2.isFile() ? fs.readFileSync(filePath2, 'utf8') : '';
        const mtime1 = stat1 ? getTimestamp(fs.statSync(filePath1).mtime) : '';
        const mtime2 = stat2 ? getTimestamp(fs.statSync(filePath2).mtime) : '';
        const relPath1 = path.relative(basedir1 || file1, filePath1);
        const relPath2 = path.relative(basedir2 || file2, filePath2);
        patch[relPath2] = diff.structuredPatch(relPath1, relPath2, text1, text2, mtime1, mtime2);
        if ((stat1 && stat1.isDirectory()) || (stat2 && stat2.isDirectory())) {
          patch = { ...patch, ...createPatch(filePath1, filePath2, file1, file2) };
        }
      }
    } else {
      const text1 = fs.readFileSync(file1, 'utf8');
      const text2 = fs.readFileSync(file2, 'utf8');
      const mtime1 = getTimestamp(fs.statSync(file1).mtime);
      const mtime2 = getTimestamp(fs.statSync(file2).mtime);
      const relPath1 = path.relative(basedir1 || path.dirname(file1), file1);
      const relPath2 = path.relative(basedir2 || path.dirname(file2), file2);
      patch[relPath2] = diff.structuredPatch(relPath1, relPath2, text1, text2, mtime1, mtime2);
    }
  } catch (e) {
    console.error(e);
  }
  return patch;
};

const isPatchObj = (patchObj: Patch | diff.IUniDiff): patchObj is Patch => {
  return !patchObj.hunks;
};

interface ParsedPatch {
  pkgVersion: string;
  diffs: diff.IUniDiff[];
}

const PKG_VERSION_REGEX = /^---[^\t]+\t[^\t]+\t(.*)$/m;

export const parsePatch = (contents: string, options?: any): ParsedPatch => {
  const result: ParsedPatch = { pkgVersion: null, diffs: null };

  const matches = contents.match(PKG_VERSION_REGEX);

  result.pkgVersion = matches ? matches[1] : null;
  result.diffs = diff.parsePatch(contents, options);

  return result;
};

export const patchToStr = (patch: Patch | diff.IUniDiff): string => {
  if (!isPatchObj(patch)) {
    const lines = [];
    lines.push('--- ' + patch.oldFileName + '\t' + patch.oldHeader);
    lines.push('+++ ' + patch.newFileName + '\t' + patch.newHeader);

    for (const hunk of patch.hunks) {
      lines.push('@@ -' + hunk.oldStart + ',' + hunk.oldLines + ' +' + hunk.newStart + ',' + hunk.newLines + ' @@');
      lines.push(...hunk.lines);
    }
    return patch.hunks.length === 0 ? '' : lines.join('\n') + '\n';
  } else {
    let result = '';
    for (const key of Object.keys(patch)) {
      result = result + patchToStr(patch[key]);
    }
    return result;
  }
};

export const parsePkgVersionFromPatch = (patchPath: string): string => {
  const contents = fs.readFileSync(patchPath, 'utf8');
  const matches = contents.match(/^---[\s]([^\t\\/]+)/m);
  if (!matches || matches.length <= 1 || !matches[1].startsWith('npm-')) {
    throw new Error(`Non larix patch detected at: ${patchPath}`);
  } else {
    const parts = matches[1].split('-');
    return parts[parts.length - 1];
  }
};
