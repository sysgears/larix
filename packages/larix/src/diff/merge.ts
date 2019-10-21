import { exec } from 'child_process';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import * as tmp from 'tmp';
import { getDirFiles } from '../fs/getDirFiles';

const DIFF3_PROCESS_LIMIT = 32;

interface MaybeConflictingContents {
  unified?: string;
  mine?: string;
  yours?: string;
}

const CONFLICT_MINE = '<<<<<<<';
const CONFLICT_YOURS = '=======';
const CONFLICT_END = '>>>>>>>';

interface ConflictingHunk {
  unified: string[];
  mine: string[];
  yours: string[];
}

enum HunkState {
  None,
  Mine,
  Yours
}

const getConflictingHunks = (lines: string[]): ConflictingHunk[] => {
  const hunks = [];
  let curHunk: ConflictingHunk = { unified: [], mine: [], yours: [] };
  let state: HunkState = HunkState.None;
  const pushAndResetCurHunk = () => {
    if (curHunk.mine.length > 0 || curHunk.yours.length > 0 || curHunk.unified.length > 0) {
      hunks.push(curHunk);
    }
    curHunk = { mine: [], yours: [], unified: [] };
  };
  for (const line of lines) {
    if (line.indexOf(CONFLICT_MINE) === 0 && state === HunkState.None) {
      state = HunkState.Mine;
      pushAndResetCurHunk();
    } else if (line.indexOf(CONFLICT_YOURS) === 0 && state === HunkState.Mine) {
      state = HunkState.Yours;
    } else if (line.indexOf(CONFLICT_END) === 0 && state === HunkState.Yours) {
      pushAndResetCurHunk();
      state = HunkState.None;
    } else {
      if (state === HunkState.Mine) {
        curHunk.mine.push(line);
      } else if (state === HunkState.Yours) {
        curHunk.yours.push(line);
      } else {
        curHunk.unified.push(line);
      }
    }
  }
  pushAndResetCurHunk();
  return hunks;
};

export const readMaybeConflictedFile = (filePath: string): MaybeConflictingContents => {
  const contents: MaybeConflictingContents = {};
  const fileContents = fs.readFileSync(filePath, 'utf8');
  const lines = fileContents.split(/\r\n|\r|\n/);
  const hunks = getConflictingHunks(lines);
  console.log('hunks:', hunks);
  for (const hunk of hunks) {
    if (hunk.mine.length > 0 || hunk.yours.length > 0) {
      if (contents.unified !== undefined) {
        contents.mine = contents.unified;
        contents.yours = contents.unified;
        delete contents.unified;
      }
      contents.mine = (contents.mine || '') + hunk.mine.join(os.EOL);
      contents.yours = (contents.yours || '') + hunk.yours.join(os.EOL);
    } else {
      if (contents.mine === undefined) {
        contents.unified = (contents.unified || '') + hunk.unified.join(os.EOL);
      } else {
        contents.mine += hunk.unified.join(os.EOL);
        contents.yours += hunk.unified.join(os.EOL);
      }
    }
  }
  return contents;
};

const merge = async (mineDir: string, oldDir: string, yourDir: string) => {
  const files = [...getDirFiles(mineDir), ...getDirFiles(oldDir), ...getDirFiles(yourDir)].filter(
    (el, idx, array) => array.indexOf(el) === idx
  );
  let tmpObj = tmp.dirSync({ unsafeCleanup: true });
  try {
    const queue = [];
    for (const file of files) {
      let mineFile = path.join(mineDir, file);
      if (!fs.existsSync(mineFile)) {
        mineFile = '/dev/null';
      }
      let oldFile = path.join(oldDir, file);
      if (!fs.existsSync(oldFile)) {
        oldFile = '/dev/null';
      }
      let yourFile = path.join(yourDir, file);
      if (!fs.existsSync(yourFile)) {
        yourFile = '/dev/null';
      }
      const outputFile = path.join(tmpObj.name, file);
      const cmd = `diff3 -m ${mineFile} ${oldFile} ${yourFile}`;
      const p = new Promise((resolve, reject) => {
        exec(cmd, (_, stdout, stderr) => {
          if (stderr) {
            reject(new Error(`Error merging file: ${file}:\n${stderr}`));
          } else {
            fs.mkdirpSync(path.dirname(outputFile));
            fs.writeFileSync(outputFile, stdout);
            resolve();
          }
        });
      })
        .then(() => {
          queue.splice(queue.indexOf(p), 1);
        })
        .catch(err => {
          queue.splice(queue.indexOf(p), 1);
          throw err;
        });

      queue.push(p);
      if (queue.length >= DIFF3_PROCESS_LIMIT) {
        await Promise.race(queue);
      }
    }
    await Promise.all(queue);
    const tmpMineDir = mineDir + '.bkp';
    fs.moveSync(mineDir, tmpMineDir);
    fs.moveSync(tmpObj.name, mineDir);
    tmpObj = null;
    fs.removeSync(tmpMineDir);
  } finally {
    if (tmpObj) {
      tmpObj.removeCallback();
    }
  }
};

interface Versions {
  baseVersion: string;
  newVersion: string;
}

const parseVersionsFromMaybeConflictingFile = (filePath: string): Versions => {
  const result: Versions = { baseVersion: undefined, newVersion: undefined };
  const fileContents = fs.readFileSync(filePath, 'utf8');
  const hasConflics = new RegExp('^' + CONFLICT_MINE + ' ', 'm').test(fileContents);
  if (hasConflics) {
    result.baseVersion = '';
  }

  return result;
};

export { merge, parseVersionsFromMaybeConflictingFile };
